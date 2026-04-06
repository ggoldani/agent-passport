#![cfg(test)]

extern crate std;

use soroban_sdk::Env;

fn test_env() -> Env {
    Env::default()
}

#[test]
fn env_bootstraps_for_contract_tests() {
    let _env = test_env();
}
