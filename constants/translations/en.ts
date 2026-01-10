

export const TRANSLATIONS_EN = {
    // Sidebar
    nav_dashboard: 'Dashboard',
    nav_new_robot: 'New Robot',
    nav_wiki: 'Wiki & Guide',
    nav_ai_settings: 'AI Settings',
    nav_db_settings: 'Database Settings',
    nav_sign_out: 'Sign Out',
    
    // Dashboard
    dash_title: 'My Trading Robots',
    dash_subtitle: 'Manage and monitor your automated strategies.',
    dash_create_btn: 'Create New Robot',
    dash_search_placeholder: 'Search robots...',
    dash_no_robots_title: 'No Robots Yet',
    dash_no_robots_desc: 'Get started by generating your first AI-powered trading algorithm.',
    dash_start_generating: 'Start Generating',
    dash_no_matches: 'No matches found',
    dash_clear_filters: 'Clear Filters',
    dash_delete_confirm: 'Are you sure you want to delete "{name}"? This action cannot be undone.',
    dash_toast_delete_success: 'Robot deleted successfully',
    dash_toast_duplicate_success: 'Robot duplicated successfully',
    
    // Settings Modal
    settings_title: 'AI Configuration',
    settings_language: 'Language',
    settings_provider: 'Provider Preset',
    settings_api_key: 'API Key(s)',
    settings_api_desc: 'Enter multiple keys on separate lines to automatically rotate usage.',
    settings_model: 'Model Name',
    settings_base_url: 'Base URL',
    settings_custom_instruct: 'Custom System Instructions',
    settings_save: 'Save Settings',
    settings_reset: 'Reset Defaults',
    settings_test: 'Test Connection',
    settings_test_success: 'Connection Successful!',
    
    // Strategy Config
    config_title: 'Configuration',
    config_reset: 'Reset',
    config_import_clipboard: 'Import JSON',
    config_copy: 'Copy JSON',
    config_general: 'General Settings',
    config_timeframe: 'Timeframe',
    config_symbol: 'Symbol',
    config_risk: 'Risk (%)',
    config_magic: 'Magic Number',
    config_logic: 'Trade Logic',
    config_sl: 'Stop Loss (Pips)',
    config_tp: 'Take Profit (Pips)',
    config_custom_inputs: 'Custom Inputs',
    config_add_input: 'Add Input',
    config_apply_btn: 'Apply Changes & Regenerate',
    config_applying: 'Applying...',
    
    // Chat
    chat_title: 'AI Chat',
    chat_clear: 'Clear',
    chat_placeholder: 'Describe logic or ask for changes...',
    chat_welcome_title: 'QuantForge AI Assistant',
    chat_welcome_desc: 'I can generate MQL5 code, explain logic, and analyze risks. Choose a template to start:',
    chat_stop: 'Stop',

    // Generator Page
    gen_tab_chat: 'AI Chat',
    gen_tab_settings: 'Settings',
    gen_tab_editor: 'Code Editor',
    gen_tab_analysis: 'Analysis',
    gen_tab_simulation: 'Simulation',
    gen_save: 'Save',
    gen_saving: 'Saving...',
    gen_placeholder_name: 'Robot Name',
    gen_mobile_setup: 'Setup & Chat',
    gen_mobile_result: 'Code & Result',
    gen_no_analysis: 'Generate some code to see the analysis.',
    gen_risk_profile: 'Risk Profile',
    gen_risk_est: 'Risk Score Estimation',
    gen_ai_summary: 'AI Summary',
    gen_profitability: 'Profitability Potential',
    
    // Editor
    editor_source: 'MQL5 Source',
    editor_edit: 'Edit Code',
    editor_done: 'Done Editing',
    editor_refine: 'Auto-Refine',
    editor_explain: 'Explain',
    editor_copy: 'Copy',
    editor_copied: 'Copied!',
    editor_download: 'Download .mq5',
    
    // Backtest
    bt_deposit: 'Initial Deposit ($)',
    bt_duration: 'Duration (Days)',
    bt_leverage: 'Leverage',
    bt_run: 'Run Simulation',
    bt_export: 'Export CSV',
    bt_no_run: 'No Simulation Run',
    bt_final_bal: 'Final Balance',

    // Keyboard Shortcuts
    kb_title: 'Keyboard Shortcuts',
    kb_save_strategy: 'Save strategy',
    kb_send_chat: 'Send chat message',
    kb_stop_generation: 'Stop AI generation',
    kb_next_field: 'Next field',
    kb_prev_field: 'Previous field',
    bt_total_ret: 'Total Return',
    bt_max_dd: 'Max Drawdown',
    bt_win_rate: 'Est. Win Rate',
    bt_equity_curve: 'Projected Equity Curve (Monte Carlo)',
    bt_warn_analysis: '* Generate code and wait for AI analysis before running simulation.',
    
    // Auth
    auth_signin_title: 'Sign in to access your trading bots',
    auth_signup_title: 'Create an account to start generating',
    auth_email: 'Email',
    auth_password: 'Password',
    auth_btn_signin: 'Sign In',
    auth_btn_signup: 'Create Account',
    auth_switch_signup: "Don't have an account? Sign up",
    auth_switch_signin: "Already have an account? Sign in",
    auth_toast_signin: 'Signed in successfully',
    auth_toast_check_email: 'Check your email for the login link!',
    
    // Database Settings
    db_title: 'Database Settings',
    db_stats_storage: 'Current Storage',
    db_stats_records: 'Records',
    db_mode_label: 'Storage Mode',
    db_mode_mock: 'Local Mock (Offline)',
    db_mode_supabase: 'Supabase Cloud',
    db_url: 'Project URL',
    db_key: 'Anon Public Key',
    db_migration_title: 'Cloud Migration',
    db_migration_desc: 'Move your local robots to Supabase.',
    db_migration_btn: 'Migrate Local Data',
    db_migrating: 'Migrating...',
    db_test_btn: 'Test & Check DB',
    db_testing: 'Checking...',
    db_save_btn: 'Save Changes',
    db_data_mgmt: 'Data Management',
    db_export: 'Export JSON',
    db_import: 'Import JSON',
    
    // Market Ticker
    mt_connecting: 'Connecting to Feed...',
    mt_unavailable: 'Data Unavailable',
    mt_live: 'Live Feed',
    mt_bid: 'Bid',
    mt_ask: 'Ask',
    mt_spread: 'Spread',
    
    // General
    loading: 'Loading...',
};

export const TRANSLATIONS = {
    en: TRANSLATIONS_EN,
};