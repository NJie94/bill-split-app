use crate::models::*;
use actix_web::{web, HttpResponse, ResponseError};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CalcError {
    #[error("Must have at least one participant")]
    NoParticipants,
    #[error("Percentage split but percentages do not sum to 100")]
    BadPercentSum,
}

impl ResponseError for CalcError {
    fn error_response(&self) -> HttpResponse {
        HttpResponse::BadRequest().body(self.to_string())
    }
}

pub fn calculate(state: &BillSplitState) -> Result<Vec<Result>, CalcError> {
    let parts = &state.participants;
    if parts.is_empty() {
        return Err(CalcError::NoParticipants);
    }

    // total paid
    let total: f64 = parts.iter().map(|p| p.paid).sum();

    // compute each share
    let mut intermediate = vec![];
    if state.split_mode == "percentage" {
        let sum_pct: f64 = parts.iter().map(|p| p.percentage.unwrap_or(0.0)).sum();
        if (sum_pct - 100.0).abs() > 0.01 {
            return Err(CalcError::BadPercentSum);
        }
    }

    for p in parts {
        let share = match state.split_mode.as_str() {
            "equal" => total / (state.num_people as f64),
            "percentage" => total * (p.percentage.unwrap_or(0.0) / 100.0),
            "solo" => if p.is_payer.unwrap_or(false) { total } else { 0.0 },
            _ => 0.0,
        };
        intermediate.push((
            p.name.clone(),
            p.paid,
            (share * 100.0).round() / 100.0  // round to 2dp
        ));
    }

    // compute balances
    let mut results: Vec<_> = intermediate.iter()
        .map(|(n, paid, share)| {
            let balance = (paid - share * 100.0 / 100.0).round() / 100.0;
            (n.clone(), *paid, *share, balance)
        })
        .collect();

    // match debtors ↔ creditors
    let mut debtors: Vec<_> = results.iter()
        .filter(|(_, _, _, b)| *b < 0.0)
        .map(|(n, _, _, b)| (n.clone(), -b, vec![]))
        .collect();
    let mut creditors: Vec<_> = results.iter()
        .filter(|(_, _, _, b)| *b > 0.0)
        .map(|(n, _, _, b)| (n.clone(), *b))
        .collect();

    let mut payments_map = std::collections::HashMap::new();
    for (name, _, _) in &debtors {
        payments_map.insert(name.clone(), vec![]);
    }

    let (mut i, mut j) = (0usize, 0usize);
    while i < debtors.len() && j < creditors.len() {
        let (dname, damt, dvec) = &mut debtors[i];
        let (cname, camt) = &mut creditors[j];
        let amt = damt.min(*camt);

        payments_map.get_mut(dname).unwrap().push(Payment { to: cname.clone(), amount: amt });

        *damt -= amt;
        *camt -= amt;
        if (*damt - 0.0).abs() < f64::EPSILON { i += 1 }
        if (*camt - 0.0).abs() < f64::EPSILON { j += 1 }
    }

    // build final
    let final_results = results.into_iter()
        .map(|(name, paid, share, balance)| Result {
            name,
            paid,
            share,
            balance,
            payments: payments_map.remove(&name).unwrap_or_default()
        })
        .collect();

    Ok(final_results)
}

pub async fn calculate_handler(
    payload: web::Json<BillSplitState>
) -> Result<HttpResponse, CalcError> {
    let res = calculate(&payload.0)?;
    Ok(HttpResponse::Ok().json(res))
}
