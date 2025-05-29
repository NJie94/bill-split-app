// backend/src/handlers.rs

use crate::models::{BillSplitState, SplitResult, Payment};
use actix_web::{web, HttpResponse, Result as ActixResult};
use std::collections::HashMap;
use thiserror::Error;

/// Errors that can occur during calculation
#[derive(Error, Debug)]
pub enum CalcError {
    #[error("Must have at least one participant")]
    NoParticipants,
    #[error("Percentages must sum to 100")]
    BadPercentSum,
}

impl actix_web::ResponseError for CalcError {}

/// Core business logic: given a BillSplitState, produce a Vec<SplitResult>
pub fn calculate(
    state: &BillSplitState
) -> std::result::Result<Vec<SplitResult>, CalcError> {
    let parts = &state.participants;
    if parts.is_empty() {
        return Err(CalcError::NoParticipants);
    }

    // 1) compute total paid
    let total: f64 = parts.iter().map(|p| p.paid).sum();

    // 2) if percentage mode, ensure they sum≈100
    if state.split_mode == "percentage" {
        let sum_pct: f64 = parts.iter()
            .map(|p| p.percentage.unwrap_or(0.0))
            .sum();
        if (sum_pct - 100.0).abs() > 0.01 {
            return Err(CalcError::BadPercentSum);
        }
    }

    // 3) build intermediate (name, paid, share)
    let intermediate: Vec<(String, f64, f64)> = parts.iter().map(|p| {
        let share = match state.split_mode.as_str() {
            "equal"      => total / (state.num_people as f64),
            "percentage" => total * (p.percentage.unwrap_or(0.0) / 100.0),
            "solo"       => if p.is_payer.unwrap_or(false) { total } else { 0.0 },
            _            => 0.0,
        };
        // round share to 2 decimals
        let share = (share * 100.0).round() / 100.0;
        (p.name.clone(), p.paid, share)
    }).collect();

    // 4) compute balances: (name, paid, share, balance)
    let balances: Vec<(String, f64, f64, f64)> = intermediate.iter()
        .map(|(name, paid, share)| {
            let balance = ((paid - *share) * 100.0).round() / 100.0;
            (name.clone(), *paid, *share, balance)
        })
        .collect();

    // 5) split into debtors and creditors
    let mut debtors: Vec<(String, f64)> = balances.iter()
        .filter(|(_, _, _, b)| *b < 0.0)
        .map(|(n, _, _, b)| (n.clone(), -*b))
        .collect();

    let mut creditors: Vec<(String, f64)> = balances.iter()
        .filter(|(_, _, _, b)| *b > 0.0)
        .map(|(n, _, _, b)| (n.clone(), *b))
        .collect();

    // 6) prepare map of payments
    let mut pay_map: HashMap<String, Vec<Payment>> = HashMap::new();
    for (name, _) in &debtors {
        pay_map.insert(name.clone(), Vec::new());
    }

    // 7) greedy match debtors → creditors
    let (mut i, mut j) = (0usize, 0usize);
    while i < debtors.len() && j < creditors.len() {
        let (ref dname, ref mut damt) = debtors[i];
        let (ref cname, ref mut camt) = creditors[j];

        let amt = damt.min(*camt);
        let amt = (amt * 100.0).round() / 100.0;

        pay_map.get_mut(dname)
            .unwrap()
            .push(Payment { to: cname.clone(), amount: amt });

        *damt -= amt;
        *camt -= amt;

        if damt.abs() < f64::EPSILON { i += 1; }
        if camt.abs() < f64::EPSILON { j += 1; }
    }

    // 8) assemble final Vec<SplitResult>
    let final_results: Vec<SplitResult> = balances.into_iter()
        .map(|(name, paid, share, balance)| {
            let payments = pay_map.remove(&name).unwrap_or_default();
            SplitResult {
                name,
                paid,
                share,
                balance,
                payments,
            }
        })
        .collect();

    Ok(final_results)
}

/// HTTP handler: POST /api/bill-split/calculate
pub async fn calculate_handler(
    payload: web::Json<BillSplitState>
) -> ActixResult<HttpResponse> {
    let out = calculate(&payload.0)?;
    Ok(HttpResponse::Ok().json(out))
}
