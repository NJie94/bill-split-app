use serde::{Deserialize, Serialize};

pub type SplitMode = String; // "equal", "percentage", or "solo"

#[derive(Deserialize)]
pub struct BillSplitParticipant {
    pub name: String,
    pub paid: f64,
    #[serde(default)]
    pub percentage: Option<f64>,
    #[serde(default)]
    pub is_payer: Option<bool>,
}

#[derive(Deserialize)]
pub struct BillSplitState {
    pub split_mode: SplitMode,
    pub num_people: usize,
    pub participants: Vec<BillSplitParticipant>,
}

#[derive(Serialize)]
pub struct Payment { pub to: String, pub amount: f64 }

#[derive(Serialize)]
pub struct Result {
    pub name: String,
    pub paid: f64,
    pub share: f64,
    pub balance: f64,
    pub payments: Vec<Payment>,
}
