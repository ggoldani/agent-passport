extern crate std;

use soroban_sdk::{Address, Env};

fn test_env() -> Env {
    Env::default()
}

#[test]
fn init_persists_admin_and_relayer_config() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );
    let authorized_relayer = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );

    client.init(&admin, &authorized_relayer);

    let config = client.get_config();
    assert_eq!(config.admin, admin);
    assert_eq!(config.authorized_relayer, authorized_relayer);
}

#[test]
#[should_panic(expected = "ContractError(1)")]
fn init_rejects_reinitialization() {
    let env = test_env();
    let contract_id = env.register(AgentPassport, ());
    let client = AgentPassportClient::new(&env, &contract_id);
    let admin = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );
    let authorized_relayer = Address::from_str(
        &env,
        "CBESJIMX7J53SWJGJ7WQ6QTLJI4S5LPPJNC2BNVD63GIKAYCDTDOO322",
    );

    client.init(&admin, &authorized_relayer);
    client.init(&admin, &authorized_relayer);
}
