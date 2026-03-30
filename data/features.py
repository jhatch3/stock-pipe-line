import pandas as pd 

"""
Risk:
    - Volatility
    - Skewness
    - Kurtosis 
    - Maximum Drawdown
    - VaR

Risk Adjusted Return Metrics:
    - Sharpe Ratio
    - Sortino Ratio
    - Information Ratio

Benchmark Related Metrics:
    - Beta
    - Alpha
    - correlation coefficient
    - R-squared 

Core Valuation Metrics:
    - Price to Earnings Ratio (P/E)
    - Price to Book Ratio (P/B)
    - Price to Sales Ratio (P/S) ??
    - price to cash flow ratio (P/CF) ??

Profitability Metrics:
    - Earning per Share (EPS)
    - Return on Equity (ROE)
    - Return on Assets (ROA)

Financial Health and Performance Metrics:
    - Debt to Equity Ratio (D/E)
    - Current Ratio
    - Interest Coverage Ratio (ICR)

Technical Indicators:
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - Bollinger Bands
    - Volume Weighted Average Price (VWAP)
    - VIX (Volatility Index)


"""

import warnings
import numpy as np
import pandas as pd
import yfinance as yf
from scipy import stats
 
warnings.filterwarnings("ignore")
 
TRADING_DAYS = 252
RISK_FREE_RATE = 0.05          # Annual — update to current T-bill rate as needed
TRADING_HOURS_PER_YEAR = 1638  # 252 trading days × 6.5 hrs
ROLLING_WINDOW = 195           # ~30 trading days of hourly bars
 
 
class StockMetrics:
    """
    Fetches and computes all metrics for a given ticker.
 
    ticker      : str   — e.g. "AAPL"
    benchmark   : str   — benchmark ticker, default S&P 500 (^GSPC)
    period      : str   — yfinance period: "1y", "2y", "5y", etc.
    interval    : str   — yfinance interval: "1d", "1wk"
    var_conf    : float — confidence level for VaR, e.g. 0.95
    """
 
    def __init__(
        self,
        ticker: str,
        benchmark: str = "^GSPC",
        period: str = "2y",
        interval: str = "1d",
        var_conf: float = 0.95,
    ):
        self.ticker = ticker.upper()
        self.benchmark = benchmark
        self.period = period
        self.interval = interval
        self.var_conf = var_conf
 
        # --- Fetch data ---
        self._tk = yf.Ticker(self.ticker) # Get from yfinance Ticker object for info and metadata
        self._bk = yf.Ticker(self.benchmark) 
        self._info = self._tk.info or {}
 
        raw = yf.download(
            [self.ticker, self.benchmark],
            period=self.period,
            interval=self.interval,
            progress=False,
            auto_adjust=True,
        )
 
        # Support both single and multi-ticker column structures
        if isinstance(raw.columns, pd.MultiIndex):
            self._price = raw["Close"][self.ticker].dropna()
            self._bm_price = raw["Close"][self.benchmark].dropna()
            self._volume = raw["Volume"][self.ticker].dropna()
            self._high = raw["High"][self.ticker].dropna()
            self._low = raw["Low"][self.ticker].dropna()
        else:
            raise ValueError("Unexpected DataFrame structure from yf.download.")
 
        self._returns = self._price.pct_change().dropna()
        self._bm_returns = self._bm_price.pct_change().dropna()
 
        # Align stock and benchmark returns to the same dates
        aligned = self._returns.align(self._bm_returns, join="inner")
        self._returns_aligned = aligned[0]
        self._bm_returns_aligned = aligned[1]

# =========================================================================
# RISK METRICS
# =========================================================================
 
    def volatility(self) -> float:
        """Annualised historical volatility (std of daily returns × √252)."""
        return float(self._returns.std() * np.sqrt(TRADING_DAYS))
 
    def skewness(self) -> float:
        """Skewness of daily return distribution."""
        return float(stats.skew(self._returns))
 
    def kurtosis(self) -> float:
        """Excess kurtosis of daily return distribution."""
        return float(stats.kurtosis(self._returns))
 
    def max_drawdown(self) -> float:
        """Maximum peak-to-trough drawdown as a negative decimal."""
        cumulative = (1 + self._returns).cumprod()
        rolling_max = cumulative.cummax()
        drawdowns = (cumulative - rolling_max) / rolling_max
        return float(drawdowns.min())
 
    def value_at_risk(self) -> float:
        """
        Parametric (Gaussian) Value at Risk at the configured confidence level.
        Returns the loss threshold as a negative decimal.
        e.g. -0.032 means "95% of days, you won't lose more than 3.2%"
        """
        mu = self._returns.mean()
        sigma = self._returns.std()
        return float(stats.norm.ppf(1 - self.var_conf, mu, sigma))
 
    # =========================================================================
    # RISK-ADJUSTED RETURN METRICS
    # =========================================================================
 
    def sharpe_ratio(self) -> float:
        """Annualised Sharpe Ratio."""
        daily_rf = RISK_FREE_RATE / TRADING_DAYS
        excess = self._returns - daily_rf
        return float((excess.mean() / excess.std()) * np.sqrt(TRADING_DAYS))
 
    def sortino_ratio(self) -> float:
        """
        Annualised Sortino Ratio.
        Uses only downside deviation (negative returns) in the denominator.
        """
        daily_rf = RISK_FREE_RATE / TRADING_DAYS
        excess = self._returns - daily_rf
        downside = excess[excess < 0]
        downside_std = np.sqrt((downside**2).mean())
        if downside_std == 0:
            return np.nan
        return float((excess.mean() / downside_std) * np.sqrt(TRADING_DAYS))
 
    def information_ratio(self) -> float:
        """
        Information Ratio vs benchmark.
        IR = mean(active return) / std(active return) × sqrt(252)
        """
        active_returns = self._returns_aligned - self._bm_returns_aligned
        tracking_error = active_returns.std() * np.sqrt(TRADING_DAYS)
        if tracking_error == 0:
            return np.nan
        return float((active_returns.mean() * TRADING_DAYS) / tracking_error)
 
# =========================================================================
# BENCHMARK-RELATED METRICS
# =========================================================================
 
    def _ols(self):
        """OLS regression of stock returns on benchmark returns."""
        x = self._bm_returns_aligned.values
        y = self._returns_aligned.values
        slope, intercept, r, p, se = stats.linregress(x, y)
        return slope, intercept, r
 
    def beta(self) -> float:
        """Beta — sensitivity to benchmark movements."""
        slope, _, _ = self._ols()
        return float(slope)
 
    def alpha(self) -> float:
        """
        Jensen's Alpha (annualised).
        α = annualised intercept from OLS of excess returns.
        """
        _, intercept, _ = self._ols()
        return float(intercept * TRADING_DAYS)
 
    def correlation(self) -> float:
        """Pearson correlation coefficient with benchmark."""
        _, _, r = self._ols()
        return float(r)
 
    def r_squared(self) -> float:
        """R² — proportion of variance explained by the benchmark."""
        _, _, r = self._ols()
        return float(r**2)

# =========================================================================
# CORE VALUATION METRICS
# =========================================================================
 
    def pe_ratio(self) -> float | None:
        """Trailing P/E ratio."""
        return self._info.get("trailingPE")
 
    def forward_pe(self) -> float | None:
        """Forward P/E ratio."""
        return self._info.get("forwardPE")
 
    def pb_ratio(self) -> float | None:
        """Price-to-Book ratio."""
        return self._info.get("priceToBook")
 
    def ps_ratio(self) -> float | None:
        """Price-to-Sales ratio (trailing 12 months)."""
        return self._info.get("priceToSalesTrailing12Months")
 
    def pcf_ratio(self) -> float | None:
        """
        Price-to-Cash-Flow ratio.
        Calculated as: market cap / operating cash flow.
        """
        market_cap = self._info.get("marketCap")
        op_cf = self._info.get("operatingCashflow")
        if market_cap and op_cf and op_cf != 0:
            return float(market_cap / op_cf)
        return None
 
    def peg_ratio(self) -> float | None:
        """
        PEG Ratio.
        Falls back to manual calculation (trailing P/E / earnings growth)
        if the API field is missing (known issue since mid-2025).
        """
        peg = self._info.get("pegRatio")
        if peg is not None:
            return float(peg)
        # Manual fallback
        pe = self.pe_ratio()
        growth = self._info.get("earningsGrowth")
        if pe and growth and growth > 0:
            return float(pe / (growth * 100))
        return None
 
    def ev_ebitda(self) -> float | None:
        """Enterprise Value / EBITDA."""
        return self._info.get("enterpriseToEbitda")
 
# =========================================================================
# PROFITABILITY METRICS
# =========================================================================
 
    def eps(self) -> float | None:
        """Earnings Per Share (trailing twelve months)."""
        return self._info.get("epsTrailingTwelveMonths")
 
    def roe(self) -> float | None:
        """Return on Equity."""
        return self._info.get("returnOnEquity")
 
    def roa(self) -> float | None:
        """Return on Assets."""
        return self._info.get("returnOnAssets")
 
    def net_profit_margin(self) -> float | None:
        """Net profit margin."""
        return self._info.get("profitMargins")
 
# =========================================================================
# FINANCIAL HEALTH METRICS
# =========================================================================
 
    def debt_to_equity(self) -> float | None:
        """Debt-to-Equity ratio."""
        return self._info.get("debtToEquity")
 
    def current_ratio(self) -> float | None:
        """Current Ratio (current assets / current liabilities)."""
        return self._info.get("currentRatio")
 
    def interest_coverage_ratio(self) -> float | None:
        """
        Interest Coverage Ratio = EBIT / Interest Expense.
        Pulled from the income statement.
        """
        try:
            inc = self._tk.financials
            ebit = inc.loc["EBIT"].iloc[0] if "EBIT" in inc.index else None
            interest = (
                inc.loc["Interest Expense"].iloc[0]
                if "Interest Expense" in inc.index
                else None
            )
            if ebit is not None and interest and interest != 0:
                return float(abs(ebit / interest))
        except Exception:
            pass
        return None
 
# =========================================================================
# TECHNICAL INDICATORS
# =========================================================================
 
    def rsi(self, window: int = 14) -> pd.Series:
        """
        Relative Strength Index.
        Values above 70 → overbought, below 30 → oversold.
        """
        delta = self._price.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=window - 1, min_periods=window).mean()
        avg_loss = loss.ewm(com=window - 1, min_periods=window).mean()
        rs = avg_gain / avg_loss
        return 100 - (100 / (1 + rs))
 
    def macd(
        self, fast: int = 12, slow: int = 26, signal: int = 9
    ) -> pd.DataFrame:
        """
        MACD — Moving Average Convergence Divergence.
        Returns a DataFrame with columns: macd, signal, histogram.
        """
        ema_fast = self._price.ewm(span=fast, adjust=False).mean()
        ema_slow = self._price.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        return pd.DataFrame(
            {"macd": macd_line, "signal": signal_line, "histogram": histogram}
        )
 
    def bollinger_bands(self, window: int = 20, num_std: float = 2.0) -> pd.DataFrame:
        """
        Bollinger Bands.
        Returns a DataFrame with columns: middle, upper, lower, bandwidth.
        bandwidth = (upper - lower) / middle  (volatility indicator)
        """
        middle = self._price.rolling(window).mean()
        std = self._price.rolling(window).std()
        upper = middle + num_std * std
        lower = middle - num_std * std
        bandwidth = (upper - lower) / middle
        return pd.DataFrame(
            {"middle": middle, "upper": upper, "lower": lower, "bandwidth": bandwidth}
        )
 
    def vwap(self) -> pd.Series:
        """
        Volume Weighted Average Price (VWAP).
        Computed from session open to current bar (cumulative VWAP).
        Most meaningful on intraday data — on daily data it acts as a
        price-volume trend indicator.
        """
        typical_price = (self._high + self._low + self._price) / 3
        cum_vol = self._volume.cumsum()
        cum_tp_vol = (typical_price * self._volume).cumsum()
        return cum_tp_vol / cum_vol
 
    def vix(self) -> pd.Series:
        """
        Fetches the CBOE Volatility Index (^VIX) closing prices.
        VIX is a market-wide index — not specific to this ticker.
        Values > 30 indicate high market fear; < 20 indicates complacency.
        """
        vix_data = yf.download(
            "^VIX", period=self.period, interval=self.interval, progress=False, auto_adjust=True
        )
        return vix_data["Close"].squeeze()
 
# =========================================================================
# SUMMARY
# =========================================================================
 
    def summary(self) -> pd.DataFrame:
        """
        Returns all scalar metrics as a single formatted DataFrame.
        Time-series indicators (RSI, MACD, Bollinger, VWAP, VIX) are
        excluded here — call them individually.
        """
        metrics = {
            
            # Risk
            "Volatility (Ann.)": self.volatility(),
            "Skewness": self.skewness(),
            "Kurtosis": self.kurtosis(),
            "Max Drawdown": self.max_drawdown(),
            f"VaR ({int(self.var_conf * 100)}% conf.)": self.value_at_risk(),

            # Risk-Adjusted Returns
            "Sharpe Ratio": self.sharpe_ratio(),
            "Sortino Ratio": self.sortino_ratio(),
            "Information Ratio": self.information_ratio(),

            # Benchmark
            "Beta": self.beta(),
            "Alpha (Ann.)": self.alpha(),
            "Correlation": self.correlation(),
            "R-Squared": self.r_squared(),

            # Valuation
            "P/E (Trailing)": self.pe_ratio(),
            "P/E (Forward)": self.forward_pe(),
            "P/B": self.pb_ratio(),
            "P/S": self.ps_ratio(),
            "P/CF": self.pcf_ratio(),
            "PEG": self.peg_ratio(),
            "EV/EBITDA": self.ev_ebitda(),

            # Profitability
            "EPS": self.eps(),
            "ROE": self.roe(),
            "ROA": self.roa(),
            "Net Profit Margin": self.net_profit_margin(),

            # Financial Health
            "Debt / Equity": self.debt_to_equity(),
            "Current Ratio": self.current_ratio(),
            "Interest Coverage Ratio": self.interest_coverage_ratio(),
        }
 
        df = pd.DataFrame.from_dict(metrics, orient="index", columns=["Value"])
        df.index.name = f"{self.ticker} Metrics"
        return df
 
 
# =============================================================================
# QUICK DEMO
# =============================================================================
if __name__ == "__main__":
    sm = StockMetrics("AAPL", benchmark="^GSPC", period="2y")
 
    print("=" * 50)
    print(f"  STOCK METRICS SUMMARY — {sm.ticker}")
    print("=" * 50)
    print(sm.summary().to_string())
 
    print("\n--- RSI (last 5 days) ---")
    print(sm.rsi().tail())
 
    print("\n--- MACD (last 5 days) ---")
    print(sm.macd().tail())
 
    print("\n--- Bollinger Bands (last 5 days) ---")
    print(sm.bollinger_bands().tail())
 
    print("\n--- VWAP (last 5 days) ---")
    print(sm.vwap().tail())
 
    print("\n--- VIX (last 5 days) ---")
    print(sm.vix().tail())


# =============================================================================
# PER-BAR FEATURE COMPUTATION (for pipeline use)
# =============================================================================

def compute_features_df(
    ohlcv_df: pd.DataFrame,
    benchmark_df: pd.DataFrame,
    vix_series: pd.Series,
    info: dict,
    window: int = ROLLING_WINDOW,
) -> pd.DataFrame:
    """
    Compute all per-bar features for a full OHLCV DataFrame.

    Parameters
    ----------
    ohlcv_df      : DataFrame indexed by UTC timestamp, columns: open/high/low/close/volume
    benchmark_df  : DataFrame indexed by UTC timestamp, column: close  (^GSPC hourly)
    vix_series    : Series indexed by UTC timestamp (^VIX hourly close)
    info          : dict from yf.Ticker.info — fundamentals; may include "_icr" key
    window        : rolling window in bars (default 195 ≈ 30 trading days of hourly data)

    Returns
    -------
    DataFrame with same index as ohlcv_df and one column per feature.
    """
    if ohlcv_df.empty:
        return pd.DataFrame()

    price  = ohlcv_df["close"]
    high   = ohlcv_df["high"]
    low    = ohlcv_df["low"]
    volume = ohlcv_df["volume"]

    feat = pd.DataFrame(index=ohlcv_df.index)

    # -------------------------------------------------------------------------
    # TECHNICAL INDICATORS
    # -------------------------------------------------------------------------

    # RSI(14)
    delta    = price.diff()
    avg_gain = delta.clip(lower=0).ewm(com=13, min_periods=14).mean()
    avg_loss = (-delta.clip(upper=0)).ewm(com=13, min_periods=14).mean()
    rs = avg_gain / avg_loss
    feat["rsi"] = 100 - (100 / (1 + rs))

    # MACD(12, 26, 9)
    ema12        = price.ewm(span=12, adjust=False).mean()
    ema26        = price.ewm(span=26, adjust=False).mean()
    macd_line    = ema12 - ema26
    signal_line  = macd_line.ewm(span=9, adjust=False).mean()
    feat["macd"]           = macd_line
    feat["macd_signal"]    = signal_line
    feat["macd_histogram"] = macd_line - signal_line

    # Bollinger Bands(20, 2σ)
    bb_mid = price.rolling(20).mean()
    bb_std = price.rolling(20).std()
    feat["bb_middle"]    = bb_mid
    feat["bb_upper"]     = bb_mid + 2 * bb_std
    feat["bb_lower"]     = bb_mid - 2 * bb_std
    feat["bb_bandwidth"] = (feat["bb_upper"] - feat["bb_lower"]) / bb_mid

    # VWAP — resets each trading day
    typical = (high + low + price) / 3
    dates   = ohlcv_df.index.normalize()
    feat["vwap"] = (
        (typical * volume).groupby(dates).cumsum()
        / volume.groupby(dates).cumsum()
    )

    # VIX — align to our index, forward-fill gaps
    feat["vix"] = vix_series.reindex(ohlcv_df.index, method="ffill")

    # -------------------------------------------------------------------------
    # ROLLING SCALAR METRICS  (window bars ending at each bar)
    # -------------------------------------------------------------------------

    rets     = price.pct_change()
    daily_rf = RISK_FREE_RATE / TRADING_HOURS_PER_YEAR
    ann_sqrt = np.sqrt(TRADING_HOURS_PER_YEAR)

    # Volatility (annualized std)
    feat["volatility"] = rets.rolling(window).std() * ann_sqrt

    # Sharpe
    excess = rets - daily_rf
    feat["sharpe_ratio"] = (
        excess.rolling(window).mean() / rets.rolling(window).std() * ann_sqrt
    )

    # Sortino
    def _sortino(r: np.ndarray) -> float:
        exc  = r - daily_rf
        down = exc[exc < 0]
        if len(down) == 0:
            return np.nan
        dd_std = np.sqrt((down ** 2).mean())
        return (exc.mean() / dd_std) * np.sqrt(TRADING_HOURS_PER_YEAR) if dd_std else np.nan

    feat["sortino_ratio"] = rets.rolling(window).apply(_sortino, raw=True)

    # Max drawdown
    def _max_dd(r: np.ndarray) -> float:
        cum  = (1 + r).cumprod()
        peak = np.maximum.accumulate(cum)
        return ((cum - peak) / peak).min()

    feat["max_drawdown"] = rets.rolling(window).apply(_max_dd, raw=True)

    # VaR(95%) — parametric Gaussian
    feat["var_95"] = rets.rolling(window).apply(
        lambda r: float(stats.norm.ppf(0.05, r.mean(), r.std())) if r.std() > 0 else np.nan,
        raw=True,
    )

    # Skewness & Kurtosis
    feat["skewness"] = rets.rolling(window).apply(
        lambda r: float(stats.skew(r)), raw=True
    )
    feat["kurtosis"] = rets.rolling(window).apply(
        lambda r: float(stats.kurtosis(r)), raw=True
    )

    # Benchmark-based metrics
    bm_close = benchmark_df["close"].reindex(ohlcv_df.index, method="ffill")
    bm_rets  = bm_close.pct_change()

    roll_cov    = rets.rolling(window).cov(bm_rets)
    roll_bm_var = bm_rets.rolling(window).var()
    feat["beta"]        = roll_cov / roll_bm_var
    feat["correlation"] = rets.rolling(window).corr(bm_rets)
    feat["r_squared"]   = feat["correlation"] ** 2

    # Jensen's Alpha (annualised):  α = (Rp − Rf) − β·(Rm − Rf)
    # Both legs must be excess returns; omitting Rf understates/overstates α
    # by Rf·(β−1)·ann ≈ ±2–3% for typical high/low-beta stocks.
    rf_per_bar = RISK_FREE_RATE / TRADING_HOURS_PER_YEAR
    feat["alpha"] = (
        (rets.rolling(window).mean() - rf_per_bar)
        - feat["beta"] * (bm_rets.rolling(window).mean() - rf_per_bar)
    ) * TRADING_HOURS_PER_YEAR

    active = rets - bm_rets
    feat["information_ratio"] = (
        active.rolling(window).mean() / active.rolling(window).std() * ann_sqrt
    )

    # -------------------------------------------------------------------------
    # FUNDAMENTALS  (static per run — same value on every row)
    # -------------------------------------------------------------------------

    def _f(key: str) -> float:
        v = info.get(key)
        
        return float(v) if v is not None else np.nan

    feat["pe_ratio"]    = _f("trailingPE")
    feat["forward_pe"]  = _f("forwardPE")
    feat["pb_ratio"]    = _f("priceToBook")
    feat["ps_ratio"]    = _f("priceToSalesTrailing12Months")
    feat["ev_ebitda"]   = _f("enterpriseToEbitda")

    mc  = info.get("marketCap")
    ocf = info.get("operatingCashflow")
    feat["pcf_ratio"] = float(mc / ocf) if (mc and ocf and ocf != 0) else np.nan

    peg = info.get("pegRatio")
    if peg is None:
        pe     = info.get("trailingPE")
        growth = info.get("earningsGrowth")
        peg    = float(pe / (growth * 100)) if (pe and growth and growth > 0) else None
    feat["peg_ratio"] = float(peg) if peg is not None else np.nan

    feat["eps"]               = _f("epsTrailingTwelveMonths")
    feat["roe"]               = _f("returnOnEquity")
    feat["roa"]               = _f("returnOnAssets")
    feat["net_profit_margin"] = _f("profitMargins")
    feat["debt_to_equity"]    = _f("debtToEquity")
    feat["current_ratio"]     = _f("currentRatio")

    # ICR pre-computed by the pipeline and injected via info["_icr"]
    feat["interest_coverage_ratio"] = _f("_icr")

    return feat

