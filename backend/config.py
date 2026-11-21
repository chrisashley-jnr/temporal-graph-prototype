"""Central configuration and system limits for temporal-graph-prototype."""

LIMITS = {
    "max_file_size_mb": 15,
    "max_file_size_bytes": 15 * 1024 * 1024,
    "min_transactions": 100,
    "max_transactions": 25000,
    "max_accounts": 15000,
    "snapshot_gnn_max_accounts": 1000,
    "max_account_id_length": 80,
    "max_id_length": 100,
}
