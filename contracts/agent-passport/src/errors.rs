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
    SelfRatingNotAllowed = 9,
    NameTooLong = 10,
    DescriptionTooLong = 11,
    ServiceUrlTooLong = 12,
    McpServerUrlTooLong = 13,
    PaymentEndpointTooLong = 14,
    TooManyTags = 15,
    TagTooLong = 16,
    NameRequired = 17,
    DescriptionRequired = 18,
    NotPendingAdmin = 19,
    AdminTransferNotExpired = 20,
    NotAdmin = 21,
    AlreadyRelayer = 22,
    NotRelayer = 23,
    ProfileNotFound = 24,
    SelfInteractionNotAllowed = 25,
}
