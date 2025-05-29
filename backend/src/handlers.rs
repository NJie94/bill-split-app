use crate::models::{BillSplitState, SplitResult, Payment};
use actix_web::{web, HttpResponse, Result as ActixResult, Responder};
use thiserror::Error;

/// Errors converting input → output
#[derive(Error, Debug)]
pub enum CalcError {
    #[error("Must have at least one participant")]
    NoParticipants,
    #[error("Percentages must sum to 100")]
    BadPercentSum,
}

impl actix_web::ResponseError for CalcError {}

/// Business logic returns a `std::result::Result<…, CalcError>`
pub fn calculate(
    state: &BillSplitState
) -> std::result::Result<Vec<SplitResult>, CalcError> {
    let parts = &state.participants;
    if parts.is_empty() {
        return Err(CalcError::NoParticipants);
    }

    let total: f64 = parts.iter().map(|p| p.paid).sum();

    if state.split_mode == "percentage" {
        let sum_pct: f64 = parts.iter().map(|p| p.percentage.unwrap_or(0.0)).sum();
        if (sum_pct - 100.0).abs() > 0.01 {
            return Err(CalcError::BadPercentSum);
        }
    }

    // build intermediate (name, paid, share)
    let mut intermediate = vec![];
    for p in parts {
        let share = match state.split_mode.as_str() {
            "equal"       => total / (state.num_people as f64),
            "percentage"  => total * (p.percentage.unwrap_or(0.0) / 100.0),
            "solo"        => if p.is_payer.unwrap_or(false) { total } else { 0.0 },
            _             => 0.0,
        };
        intermediate.push((p.name.clone(), p.paid, (share * 100.0).round() / 100.0));
    }

    // compute balances and split debtors/creditors
    let mut results: Vec<_> = intermediate.iter()
        .map(|(n, paid, share)| {
            let balance = (*paid - *share).round() / 100.0;
            (n.clone(), *paid, *share, balance)
        })
        .collect();

    let mut debtors: Vec<_>   = results.iter()
        .filter(|(_, _, _, b)| *b < 0.0)
        .map(|(n, _, _, b)| (n.clone(), -b))
        .collect();
    let mut creditors: Vec<_> = results.iter()
        .filter(|(_, _, _, b)| *b > 0.0)
        .map(|(n, _, _, b)| (n.clone(), *b))
        .collect();

    let mut pay_map = std::collections::HashMap::new();
    debtors.iter().for_each(|(n, _)| { pay_map.insert(n.clone(), vec![]); });

    let (mut i, mut j) = (0, 0);
    while i < debtors.len() && j < creditors.len() {
        let (dname, damt) = &mut debtors[i];
        let (cname, camt) = &mut creditors[j];
        let amt = damt.min(*camt);

        pay_map.get_mut(dname).unwrap()
            .push(Payment { to: cname.clone(), amount: amt });

        *damt -= amt;
        *camt -= amt;
        if damt.abs() < f64::EPSILON { i += 1 }
        if camt.abs() < f64::EPSILON { j += 1 }
    }

    // assemble final Vec<SplitResult>
    let final_results = results.into_iter()
        .map(|(name, paid, share, balance)| SplitResult {
            name,
            paid,
            share,
            balance,
            payments: pay_map.remove(&name).unwrap_or_default(),
        })
        .collect();

    Ok(final_results)
}

/// Actix handler—returns `actix_web::Result<HttpResponse>`
pub async fn calculate_handler(
    payload: web::Json<BillSplitState>
) -> ActixResult<HttpResponse> {
    let out = calculate(&payload.0)?;
    Ok(HttpResponse::Ok().json(out))
}
