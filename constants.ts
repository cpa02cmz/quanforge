
import { Language, WikiSection } from "./types";

// Re-export from new modular structure for backward compatibility
export * from './constants/index';

// --- TRANSLATIONS ---
// Keep existing translations for now until migration is complete

export const TRANSLATIONS = {
    en: {
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
    },
    id: {
        // Sidebar
        nav_dashboard: 'Dasbor',
        nav_new_robot: 'Robot Baru',
        nav_wiki: 'Wiki & Panduan',
        nav_ai_settings: 'Pengaturan AI',
        nav_db_settings: 'Pengaturan Database',
        nav_sign_out: 'Keluar',
        
        // Dashboard
        dash_title: 'Robot Trading Saya',
        dash_subtitle: 'Kelola dan pantau strategi otomatis Anda.',
        dash_create_btn: 'Buat Robot Baru',
        dash_search_placeholder: 'Cari robot...',
        dash_no_robots_title: 'Belum Ada Robot',
        dash_no_robots_desc: 'Mulai dengan membuat algoritma trading pertama Anda menggunakan AI.',
        dash_start_generating: 'Mulai Membuat',
        dash_no_matches: 'Tidak ada yang cocok',
        dash_clear_filters: 'Hapus Filter',
        dash_delete_confirm: 'Apakah Anda yakin ingin menghapus "{name}"? Tindakan ini tidak dapat dibatalkan.',
        dash_toast_delete_success: 'Robot berhasil dihapus',
        dash_toast_duplicate_success: 'Robot berhasil diduplikasi',
        
        // Settings Modal
        settings_title: 'Konfigurasi AI',
        settings_language: 'Bahasa',
        settings_provider: 'Preset Penyedia',
        settings_api_key: 'API Key',
        settings_api_desc: 'Masukkan beberapa kunci di baris terpisah untuk rotasi otomatis.',
        settings_model: 'Nama Model',
        settings_base_url: 'Base URL',
        settings_custom_instruct: 'Instruksi Sistem Kustom',
        settings_save: 'Simpan Pengaturan',
        settings_reset: 'Reset Default',
        settings_test: 'Tes Koneksi',
        settings_test_success: 'Koneksi Berhasil!',

        // Strategy Config
        config_title: 'Konfigurasi',
        config_reset: 'Reset',
        config_import_clipboard: 'Impor JSON',
        config_copy: 'Salin JSON',
        config_general: 'Pengaturan Umum',
        config_timeframe: 'Timeframe',
        config_symbol: 'Simbol',
        config_risk: 'Risiko (%)',
        config_magic: 'Magic Number',
        config_logic: 'Logika Trading',
        config_sl: 'Stop Loss (Pips)',
        config_tp: 'Take Profit (Pips)',
        config_custom_inputs: 'Input Kustom',
        config_add_input: 'Tambah Input',
        config_apply_btn: 'Terapkan & Regenerasi',
        config_applying: 'Menerapkan...',

        // Chat
        chat_title: 'Obrolan AI',
        chat_clear: 'Hapus',
        chat_placeholder: 'Jelaskan logika atau minta perubahan...',
        chat_welcome_title: 'Asisten AI QuantForge',
        chat_welcome_desc: 'Saya bisa membuat kode MQL5, menjelaskan logika, dan menganalisis risiko. Pilih template untuk memulai:',
        chat_stop: 'Berhenti',

        // Generator Page
        gen_tab_chat: 'Obrolan AI',
        gen_tab_settings: 'Pengaturan',
        gen_tab_editor: 'Editor Kode',
        gen_tab_analysis: 'Analisis',
        gen_tab_simulation: 'Simulasi',
        gen_save: 'Simpan',
        gen_saving: 'Menyimpan...',
        gen_placeholder_name: 'Nama Robot',
        gen_mobile_setup: 'Setup & Chat',
        gen_mobile_result: 'Kode & Hasil',
        gen_no_analysis: 'Buat kode untuk melihat analisis.',
        gen_risk_profile: 'Profil Risiko',
        gen_risk_est: 'Estimasi Skor Risiko',
        gen_ai_summary: 'Ringkasan AI',
        gen_profitability: 'Potensi Profitabilitas',
        
        // Editor
        editor_source: 'Sumber MQL5',
        editor_edit: 'Edit Kode',
        editor_done: 'Selesai Edit',
        editor_refine: 'Auto-Refine',
        editor_explain: 'Jelaskan',
        editor_copy: 'Salin',
        editor_copied: 'Tersalin!',
        editor_download: 'Unduh .mq5',

        // Backtest
        bt_deposit: 'Deposit Awal ($)',
        bt_duration: 'Durasi (Hari)',
        bt_leverage: 'Leverage',
        bt_run: 'Jalankan Simulasi',
        bt_export: 'Ekspor CSV',
        bt_no_run: 'Belum Ada Simulasi',
        bt_final_bal: 'Saldo Akhir',
        bt_total_ret: 'Total Return',
        bt_max_dd: 'Max Drawdown',
        bt_win_rate: 'Est. Win Rate',
        bt_equity_curve: 'Kurva Ekuitas Proyeksi (Monte Carlo)',
        bt_warn_analysis: '* Buat kode dan tunggu analisis AI sebelum menjalankan simulasi.',
        
        // Auth
        auth_signin_title: 'Masuk untuk mengakses robot Anda',
        auth_signup_title: 'Buat akun untuk memulai',
        auth_email: 'Email',
        auth_password: 'Kata Sandi',
        auth_btn_signin: 'Masuk',
        auth_btn_signup: 'Buat Akun',
        auth_switch_signup: "Belum punya akun? Daftar",
        auth_switch_signin: "Sudah punya akun? Masuk",
        auth_toast_signin: 'Berhasil masuk',
        auth_toast_check_email: 'Periksa email Anda untuk tautan login!',

        // Database Settings
        db_title: 'Pengaturan Database',
        db_stats_storage: 'Penyimpanan Saat Ini',
        db_stats_records: 'Rekaman',
        db_mode_label: 'Mode Penyimpanan',
        db_mode_mock: 'Lokal Mock (Offline)',
        db_mode_supabase: 'Supabase Cloud',
        db_url: 'URL Proyek',
        db_key: 'Kunci Publik Anon',
        db_migration_title: 'Migrasi Cloud',
        db_migration_desc: 'Pindahkan robot lokal Anda ke Supabase.',
        db_migration_btn: 'Migrasi Data Lokal',
        db_migrating: 'Sedang Migrasi...',
        db_test_btn: 'Tes & Cek DB',
        db_testing: 'Memeriksa...',
        db_save_btn: 'Simpan Perubahan',
        db_data_mgmt: 'Manajemen Data',
        db_export: 'Ekspor JSON',
        db_import: 'Impor JSON',

        // Market Ticker
        mt_connecting: 'Menghubungkan ke Feed...',
        mt_unavailable: 'Data Tidak Tersedia',
        mt_live: 'Feed Langsung',
        mt_bid: 'Bid',
        mt_ask: 'Ask',
        mt_spread: 'Spread',

        // General
        loading: 'Memuat...',
    }
};


// --- WIKI / DOCUMENTATION CONTENT ---

export const WIKI_CONTENT: Record<Language, WikiSection[]> = {
  en: [
    {
        id: 'getting-started',
        title: 'Getting Started',
        icon: '🚀',
        articles: [
          {
            title: 'Welcome to QuantForge AI',
            content: `QuantForge AI is a powerful tool designed to bridge the gap between trading ideas and executable MQL5 code. 
            
    You don't need to be a programmer to use it. Simply describe your strategy in plain English, and the AI will generate the professional-grade code for MetaTrader 5.
    
    **Key Features:**
    - **AI Generator:** Turns text into code.
    - **Configurator:** Visual tweaks for Risk, SL/TP without coding.
    - **Simulator:** Monte Carlo projections of your strategy's potential.
    - **Cloud Sync:** Save your robots to the cloud.`
          },
          {
            title: 'How to Generate a Robot',
            content: `1. Go to the **New Robot** page via the sidebar.
    2. In the **Chat Panel** (left), type your strategy. Example: *"Create a strategy that buys when Price is above EMA 200 and RSI is below 30."*
    3. Wait for the AI to generate the code.
    4. Review the code in the **Editor** (right).
    5. Check the **Analysis** tab to see the AI's risk assessment.`
          }
        ]
      },
      {
        id: 'mql5-concepts',
        title: 'MQL5 Logic Structure',
        icon: '💻',
        articles: [
          {
            title: 'OnInit() and OnTick()',
            content: `**OnInit()**: This function runs **once** when you drag the robot onto the chart. It's used to verify settings, create indicator handles, and initialize variables. If this fails, the robot won't start.
    
    **OnTick()**: This is the heartbeat of your robot. It runs **every time the price changes** (a new tick arrives). The logic inside here checks conditions and executes trades.`
          },
          {
            title: 'Inputs and Variables',
            content: `**input**: Variables starting with \`input\` are visible in the MetaTrader settings window. Users can change these without editing code (e.g., LotSize, StopLoss).
    
    **double vs int**:
    - \`double\`: Numbers with decimals (e.g., Price 1.0523, Lot 0.1).
    - \`int\`: Whole numbers (e.g., RSI Period 14, MagicNumber).
    - \`bool\`: True/False switches (e.g., UseTrailingStop = true).`
          },
          {
            title: 'Handles and Buffers',
            content: `In MQL5, indicators (like RSI or MA) work differently than MQL4.
    
    1. **Handle**: A unique ID assigned to an indicator during \`OnInit()\`.
    2. **CopyBuffer**: The function used inside \`OnTick()\` to retrieve the actual values (data) from the indicator Handle into an array for calculation.`
          }
        ]
      },
      {
        id: 'indicators',
        title: 'Technical Indicators',
        icon: '📈',
        articles: [
          {
            title: 'Moving Averages (SMA/EMA)',
            content: `**SMA (Simple Moving Average)**: The average price over X periods.
    **EMA (Exponential Moving Average)**: Gives more weight to recent prices, reacting faster to trends.
    
    *Usage*: Often used to determine trend direction. "Price above EMA 200" usually implies an uptrend.`
          },
          {
            title: 'RSI (Relative Strength Index)',
            content: `A momentum oscillator that measures the speed and change of price movements. Range: 0 to 100.
    
    - **Overbought**: Usually > 70 (Potential Sell signal).
    - **Oversold**: Usually < 30 (Potential Buy signal).`
          },
          {
            title: 'MACD',
            content: `**Moving Average Convergence Divergence**. A trend-following momentum indicator.
    
    - **MACD Line**: Difference between 12 EMA and 26 EMA.
    - **Signal Line**: 9 EMA of the MACD Line.
    - **Histogram**: Difference between MACD and Signal.
    
    *Signal*: When MACD crosses above Signal, it's bullish. Below is bearish.`
          },
          {
            title: 'Bollinger Bands',
            content: `A volatility indicator consisting of a middle band (SMA) and two outer bands (Standard Deviations).
    
    - **Squeeze**: When bands contract, volatility is low (breakout pending).
    - **Expansion**: When bands widen, volatility is high.
    - Price touching the upper band often indicates overbought conditions.`
          },
          {
            title: 'ATR (Average True Range)',
            content: `Measures market **volatility**. It does NOT indicate direction.
    
    *Usage*: Often used for dynamic Stop Loss. e.g., "Set Stop Loss at 1.5 x ATR value" allows the stop to be wider in volatile markets and tighter in calm markets.`
          }
        ]
      },
      {
        id: 'trading-terms',
        title: 'Trading Terminology',
        icon: '📚',
        articles: [
          {
            title: 'Pips vs Points',
            content: `**Pip**: The standard unit of movement in Forex. For EURUSD, 1 Pip is 0.0001.
    **Point**: The smallest price change supported by the broker. Most brokers use "5-digit pricing", meaning 1 Pip = 10 Points.
    
    *QuantForge AI inputs are in Pips for convenience, but the generated code automatically converts them to Points.*`
          },
          {
            title: 'Ask, Bid, and Spread',
            content: `**Bid**: The price you SELL at.
    **Ask**: The price you BUY at.
    **Spread**: The difference between Ask and Bid. This is the broker's fee.
    
    *Note*: Buy orders open at Ask and close at Bid. Sell orders open at Bid and close at Ask.`
          },
          {
            title: 'Magic Number',
            content: `A unique integer ID assigned to every trade opened by a robot. 
            
    This allows the robot to distinguish its own trades from manual trades or trades opened by other robots running on the same account.`
          },
          {
            title: 'Lot Size & Money Management',
            content: `**Lot**: The volume of the trade.
    - 1.00 Standard Lot = 100,000 units.
    - 0.10 Mini Lot = 10,000 units.
    - 0.01 Micro Lot = 1,000 units.
    
    *Risk Management*: It is recommended to calculate Lot Size dynamically based on Account Balance (e.g., Risk 1% of equity per trade).`
          }
        ]
      },
      {
        id: 'api-help',
        title: 'API & Market Data',
        icon: '🔌',
        articles: [
            {
                title: 'Market Data Sources',
                content: `QuantForge uses real-time WebSockets to provide live price data.
                
    1. **Crypto (Binance)**: Free and automatic. Used for pairs ending in USDT/BUSD.
    2. **Forex/Gold (Twelve Data)**: Requires a free API Key. Used for pairs with '/' or XAUUSD.`
            },
            {
                title: 'How to get Twelve Data Key',
                content: `1. Go to **twelvedata.com** and sign up.
    2. Copy your API Key from their dashboard.
    3. In QuantForge, go to **AI Settings > Market Data**.
    4. Paste the key and save.`
            },
            {
                title: 'Troubleshooting "Disconnected"',
                content: `If the Market Ticker shows "Disconnected" or "Data Unavailable":
    - **Crypto**: Check your internet connection.
    - **Forex**: Ensure your Twelve Data API key is correct and you haven't exceeded their daily limit (800 requests/day for free tier).`
            }
        ]
      },
      {
        id: 'advanced',
        title: 'Pro Tips',
        icon: '💡',
        articles: [
          {
            title: 'Custom AI Instructions',
            content: `You can customize how the AI writes code in **AI Settings**.
    
    Examples:
    - *"Always add comments in Spanish"*
    - *"Use strict variable naming with 'm_' prefix"*
    - *"Prioritize safety checks over execution speed"*`
          },
          {
            title: 'Optimizing Prompts',
            content: `To get the best results, be specific:
    
    **Bad:** "Make a good profitable bot."
    **Good:** "Create a trend following bot for EURUSD H1. Use EMA(50) and EMA(200). Buy when 50 crosses above 200. Close trade when price falls below EMA(50). Risk 1% per trade."`
          },
          {
            title: 'Importing/Exporting',
            content: `**Database**: Go to Database Settings to backup all your robots to a JSON file.
    **Config**: In the Strategy Settings panel, use "Copy JSON" to share your specific parameter configuration with others.`
          }
        ]
      }
  ],
  id: [
    {
        id: 'getting-started',
        title: 'Memulai',
        icon: '🚀',
        articles: [
          {
            title: 'Selamat Datang di QuantForge AI',
            content: `QuantForge AI adalah alat canggih yang dirancang untuk menjembatani ide trading menjadi kode MQL5 yang dapat dieksekusi.
            
    Anda tidak perlu menjadi programmer untuk menggunakannya. Cukup jelaskan strategi Anda dalam bahasa sehari-hari, dan AI akan menghasilkan kode profesional untuk MetaTrader 5.
    
    **Fitur Utama:**
    - **Generator AI:** Mengubah teks menjadi kode.
    - **Konfigurator:** Pengaturan visual untuk Risiko, SL/TP tanpa coding.
    - **Simulator:** Proyeksi Monte Carlo dari potensi strategi Anda.
    - **Cloud Sync:** Simpan robot Anda ke cloud.`
          },
          {
            title: 'Cara Membuat Robot',
            content: `1. Pergi ke halaman **Robot Baru** melalui sidebar.
    2. Di **Panel Obrolan** (kiri), ketik strategi Anda. Contoh: *"Buat strategi buy saat Harga di atas EMA 200 dan RSI di bawah 30."*
    3. Tunggu AI menghasilkan kode.
    4. Tinjau kode di **Editor** (kanan).
    5. Periksa tab **Analisis** untuk melihat penilaian risiko oleh AI.`
          }
        ]
      },
      {
        id: 'mql5-concepts',
        title: 'Struktur Logika MQL5',
        icon: '💻',
        articles: [
          {
            title: 'OnInit() dan OnTick()',
            content: `**OnInit()**: Fungsi ini berjalan **sekali** saat Anda memasang robot ke grafik. Digunakan untuk memverifikasi pengaturan, membuat handle indikator, dan inisialisasi variabel. Jika gagal, robot tidak akan mulai.
    
    **OnTick()**: Ini adalah jantung robot Anda. Berjalan **setiap kali harga berubah** (tick baru masuk). Logika di dalamnya memeriksa kondisi dan mengeksekusi trading.`
          },
          {
            title: 'Inputs dan Variabel',
            content: `**input**: Variabel yang dimulai dengan \`input\` terlihat di jendela pengaturan MetaTrader. Pengguna dapat mengubahnya tanpa mengedit kode (contoh: LotSize, StopLoss).
    
    **double vs int**:
    - \`double\`: Angka desimal (contoh: Harga 1.0523, Lot 0.1).
    - \`int\`: Angka bulat (contoh: Periode RSI 14, MagicNumber).
    - \`bool\`: Sakelar Benar/Salah (contoh: UseTrailingStop = true).`
          }
        ]
      },
      {
        id: 'indicators',
        title: 'Indikator Teknis',
        icon: '📈',
        articles: [
          {
            title: 'Moving Averages (SMA/EMA)',
            content: `**SMA (Simple Moving Average)**: Harga rata-rata selama X periode.
    **EMA (Exponential Moving Average)**: Memberikan bobot lebih pada harga terbaru, bereaksi lebih cepat terhadap tren.
    
    *Penggunaan*: Sering digunakan untuk menentukan arah tren. "Harga di atas EMA 200" biasanya menyiratkan tren naik.`
          },
          {
            title: 'RSI (Relative Strength Index)',
            content: `Osilator momentum yang mengukur kecepatan dan perubahan pergerakan harga. Rentang: 0 hingga 100.
    
    - **Overbought**: Biasanya > 70 (Potensi sinyal Jual).
    - **Oversold**: Biasanya < 30 (Potensi sinyal Beli).`
          },
          {
            title: 'MACD',
            content: `**Moving Average Convergence Divergence**. Indikator momentum mengikuti tren.
    
    - **Garis MACD**: Selisih antara EMA 12 dan EMA 26.
    - **Garis Signal**: EMA 9 dari Garis MACD.
    - **Histogram**: Selisih antara MACD dan Signal.`
          }
        ]
      },
      {
        id: 'trading-terms',
        title: 'Terminologi Trading',
        icon: '📚',
        articles: [
          {
            title: 'Pips vs Points',
            content: `**Pip**: Unit standar pergerakan di Forex. Untuk EURUSD, 1 Pip adalah 0.0001.
    **Point**: Perubahan harga terkecil yang didukung broker. Kebanyakan broker menggunakan "5 digit", artinya 1 Pip = 10 Points.
    
    *Input QuantForge AI menggunakan Pip untuk kenyamanan, tetapi kode yang dihasilkan otomatis mengonversinya ke Points.*`
          },
          {
            title: 'Ask, Bid, dan Spread',
            content: `**Bid**: Harga saat Anda MENJUAL (Sell).
    **Ask**: Harga saat Anda MEMBELI (Buy).
    **Spread**: Selisih antara Ask dan Bid. Ini adalah biaya broker.
    
    *Catatan*: Order Buy dibuka di Ask dan ditutup di Bid. Order Sell dibuka di Bid dan ditutup di Ask.`
          },
          {
            title: 'Magic Number',
            content: `ID integer unik yang diberikan untuk setiap trading yang dibuka oleh robot. 
            
    Ini memungkinkan robot membedakan trading miliknya dari trading manual atau robot lain di akun yang sama.`
          }
        ]
      },
      {
        id: 'api-help',
        title: 'API & Data Pasar',
        icon: '🔌',
        articles: [
            {
                title: 'Sumber Data Pasar',
                content: `QuantForge menggunakan WebSocket real-time untuk data harga langsung.
                
    1. **Crypto (Binance)**: Gratis dan otomatis. Digunakan untuk pasangan yang berakhiran USDT/BUSD.
    2. **Forex/Emas (Twelve Data)**: Memerlukan API Key gratis. Digunakan untuk pasangan dengan '/' atau XAUUSD.`
            },
            {
                title: 'Cara mendapatkan Key Twelve Data',
                content: `1. Kunjungi **twelvedata.com** dan daftar.
    2. Salin API Key dari dasbor mereka.
    3. Di QuantForge, buka **Pengaturan AI > Data Pasar**.
    4. Tempelkan kunci dan simpan.`
            },
            {
                title: 'Mengatasi "Terputus"',
                content: `Jika Ticker Pasar menampilkan "Terputus" atau "Data Tidak Tersedia":
    - **Crypto**: Periksa koneksi internet Anda.
    - **Forex**: Pastikan API key Twelve Data benar dan Anda belum melebihi batas harian (800 request/hari untuk paket gratis).`
            }
        ]
      },
      {
        id: 'advanced',
        title: 'Tips Pro',
        icon: '💡',
        articles: [
          {
            title: 'Instruksi AI Kustom',
            content: `Anda dapat menyesuaikan cara AI menulis kode di **Pengaturan AI**.
    
    Contoh:
    - *"Selalu tambahkan komentar dalam Bahasa Indonesia"*
    - *"Gunakan penamaan variabel ketat dengan awalan 'm_'"*`
          },
          {
            title: 'Impor/Ekspor',
            content: `**Database**: Buka Pengaturan Database untuk backup semua robot ke file JSON.
    **Config**: Di panel Pengaturan Strategi, gunakan "Salin JSON" untuk membagikan konfigurasi parameter spesifik.`
          }
        ]
      }
  ]
};
