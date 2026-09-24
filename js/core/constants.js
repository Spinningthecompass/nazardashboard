// Derived from ACCOUNTS_DB — no second copy of the account→agency map to keep in sync.
const ACCOUNT_BM = Object.fromEntries(ACCOUNTS_DB.map(a => [a.name, a.agency]));
