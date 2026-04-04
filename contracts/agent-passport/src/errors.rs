use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    OwnershipConflict = 2,
    MissingAgent = 3,
    DuplicateTxHash = 4,
    DuplicateRating = 5,
    InvalidScore = 6,
    UnauthorizedRelayer = 7,
    MissingInteraction = 8,
}
