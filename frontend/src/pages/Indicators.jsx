import katex from 'katex'
import 'katex/dist/katex.min.css'

// Indicator reference typeset as a LaTeX-style paper. Formulas match
// src/lib/indicators.js (chart overlays) and data/features.py (stored metrics).

const tex = (src, displayMode) => ({
  __html: katex.renderToString(src, { displayMode, throwOnError: false }),
})

function M({ children }) {
  return <span dangerouslySetInnerHTML={tex(children, false)} />
}

function Eq({ n, children }) {
  return (
    <div className="paper-eq">
      <div className="paper-eq-body" dangerouslySetInnerHTML={tex(children, true)} />
      <span className="paper-eq-num">({n})</span>
    </div>
  )
}

function Section({ n, id, title, children }) {
  return (
    <section id={id} className="mt-10 scroll-mt-20">
      <h2 className="text-[1.35rem] font-bold mb-3">
        <span className="mr-4">{n}</span>{title}
      </h2>
      {children}
    </section>
  )
}

function Subsection({ n, title, children }) {
  return (
    <div className="mt-6">
      <h3 className="text-[1.1rem] font-bold mb-2">
        <span className="mr-3">{n}</span>{title}
      </h3>
      {children}
    </div>
  )
}

function Definition({ n, name, children }) {
  return (
    <div className="my-4">
      <span className="font-bold">Definition {n}</span> <span>({name}).</span>{' '}
      <span className="italic">{children}</span>
    </div>
  )
}

function Remark({ title = 'Remark', children }) {
  return (
    <p className="my-3">
      <span className="italic">{title}.</span> {children}
    </p>
  )
}

function Items({ children }) {
  return <ul className="list-disc pl-8 my-2 space-y-1">{children}</ul>
}

const SECTIONS = [
  ['notation', 'Notation'],
  ['moving-averages', 'Moving Averages'],
  ['bollinger', 'Bollinger Bands'],
  ['rsi', 'Relative Strength Index'],
  ['macd', 'Moving Average Convergence Divergence'],
  ['vwap', 'Volume-Weighted Average Price'],
  ['risk', 'Risk and Return Metrics'],
  ['market', 'Market-Relative Metrics'],
]

const R = String.raw

export default function Indicators() {

  // Equations are numbered in render order, like LaTeX's \begin{equation}
  let eqn = 0
  const eq = src => <Eq n={++eqn}>{src}</Eq>

  return (
    <div className="min-h-screen bg-[#e9eaec]">

      <main className="px-3 sm:px-6 py-8">
        <article className="paper max-w-[820px] mx-auto bg-white shadow-md px-6 sm:px-16 py-14 sm:py-20">

          {/* Title block */}
          <header className="text-center mb-10">
            <h1 className="text-[1.9rem] leading-tight mb-4">
              Technical Indicators and Risk Metrics:<br />Definitions and Interpretation
            </h1>
            <p className="text-[1.05rem]">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </header>

          <div className="mx-auto max-w-[620px] mb-10">
            <p className="text-center font-bold text-sm mb-2">Abstract</p>
            <p className="text-[0.95rem] leading-relaxed text-justify">
              This note collects the definitions of every indicator plotted on the charts and every
              metric stored in the feature table. For each quantity we give a precise formula, the parameters
              used in this system, and a short account of how it is read in practice, together with its known
              limitations. Technical indicators are computed per bar from closing prices; risk and
              market-relative metrics are computed over a rolling window of hourly returns and annualized.
            </p>
          </div>

          {/* Table of contents */}
          <nav className="mb-6">
            <h2 className="text-[1.35rem] font-bold mb-3">Contents</h2>
            <ol className="space-y-1">
              {SECTIONS.map(([id, title], i) => (
                <li key={id} className="flex items-baseline gap-2">
                  <a href={`#${id}`} className="hover:underline shrink-0">
                    <span className="inline-block w-7">{i + 1}</span>{title}
                  </a>
                  <span className="flex-1 border-b border-dotted border-gray-400 translate-y-[-4px]" />
                </li>
              ))}
            </ol>
          </nav>

          {/* 1 Notation */}
          <Section n="1" id="notation" title="Notation">
            <p>
              Let <M>{R`t`}</M> index bars (hourly or daily). For each bar we observe the close <M>{R`P_t`}</M>,
              high <M>{R`H_t`}</M>, low <M>{R`L_t`}</M> and volume <M>{R`V_t`}</M>. The simple return is
            </p>
            {eq(R`r_t = \frac{P_t}{P_{t-1}} - 1 .`)}
            <p>
              Rolling statistics are taken over the last <M>{R`n`}</M> bars, written
              <M>{R`\;\overline{x} = \tfrac{1}{n}\sum_{i=0}^{n-1} x_{t-i}`}</M> for the mean and
              <M>{R`\;s(x)`}</M> for the sample standard deviation. Stored metrics use <M>{R`n = 195`}</M> hourly
              bars (about 30 trading days) and annualize with
            </p>
            {eq(R`A = 252 \times 6.5 = 1638 \ \text{hourly bars per year}.`)}
            <p>
              The risk-free rate is <M>{R`r_f = 5\%`}</M> per year, i.e. <M>{R`r_f / A`}</M> per bar, and
              <M>{R`\;m_t`}</M> denotes the return of the S&amp;P 500 index (<span className="font-mono text-[0.9em]">^GSPC</span>) over the same bar.
            </p>
          </Section>

          {/* 2 Moving averages */}
          <Section n="2" id="moving-averages" title="Moving Averages">
            <Definition n="2.1" name="Simple moving average">
              The simple moving average of length <M>{R`n`}</M> is the unweighted mean of the last <M>{R`n`}</M> closes:
            </Definition>
            {eq(R`\mathrm{SMA}_n(t) = \frac{1}{n} \sum_{i=0}^{n-1} P_{t-i} .`)}
            <Definition n="2.2" name="Exponential moving average">
              The exponential moving average weights recent closes geometrically more heavily:
            </Definition>
            {eq(R`\mathrm{EMA}_n(t) = \alpha P_t + (1-\alpha)\,\mathrm{EMA}_n(t-1), \qquad \alpha = \frac{2}{n+1} .`)}
            <p>
              Charts plot <M>{R`\mathrm{SMA}_{50}`}</M> (medium-term trend, about ten trading weeks on daily bars)
              and <M>{R`\mathrm{SMA}_{200}`}</M> (long-term trend, about forty weeks). Each requires <M>{R`n`}</M> bars
              of history before its first value, which is why extra history is fetched for warm-up.
            </p>
            <Remark title="Interpretation">
              Price above its moving average indicates an uptrend over that horizon; a moving average acting as
              support during pullbacks confirms the trend. The crossing of <M>{R`\mathrm{SMA}_{50}`}</M> above
              <M>{R`\;\mathrm{SMA}_{200}`}</M> is called a <span className="italic">golden cross</span>; the
              reverse is a <span className="italic">death cross</span>.
            </Remark>
            <Remark>
              Moving averages lag by construction, so crossover signals arrive after a move is underway. In
              sideways markets price crosses the average repeatedly and produces false signals. Because the SMA
              weights every bar equally, a single large move continues to affect it for <M>{R`n`}</M> bars.
            </Remark>
          </Section>

          {/* 3 Bollinger */}
          <Section n="3" id="bollinger" title="Bollinger Bands">
            <Definition n="3.1" name="Bollinger bands">
              With window <M>{R`n = 20`}</M> and width <M>{R`k = 2`}</M>, let <M>{R`M_t = \mathrm{SMA}_{20}(t)`}</M> and
            </Definition>
            {eq(R`\sigma_t = \sqrt{\frac{1}{n-1} \sum_{i=0}^{n-1} \left(P_{t-i} - M_t\right)^2 } .`)}
            <p>The bands and their relative width are</p>
            {eq(R`U_t = M_t + k\,\sigma_t, \qquad L_t = M_t - k\,\sigma_t, \qquad \mathrm{BW}_t = \frac{U_t - L_t}{M_t} .`)}
            <Remark title="Interpretation">
              The bands widen when volatility rises and contract when it falls. A close near <M>{R`U_t`}</M> marks
              the top of the recent range and a close near <M>{R`L_t`}</M> the bottom. An unusually small
              <M>{R`\;\mathrm{BW}_t`}</M> (a <span className="italic">squeeze</span>) often precedes a large move.
            </Remark>
            <Remark>
              Touching a band is not by itself a reversal signal: in strong trends price can ride along the band.
              A squeeze says nothing about the direction of the subsequent breakout.
            </Remark>
          </Section>

          {/* 4 RSI */}
          <Section n="4" id="rsi" title="Relative Strength Index">
            <Definition n="4.1" name="Relative strength index">
              Let <M>{R`G_t = \max(P_t - P_{t-1}, 0)`}</M> and <M>{R`D_t = \max(P_{t-1} - P_t, 0)`}</M>. With
              <M>{R`\;n = 14`}</M>, the averages are smoothed by Wilder's recursion
            </Definition>
            {eq(R`\overline{G}_t = \frac{(n-1)\,\overline{G}_{t-1} + G_t}{n}, \qquad \overline{D}_t = \frac{(n-1)\,\overline{D}_{t-1} + D_t}{n},`)}
            <p>initialized with simple averages over the first <M>{R`n`}</M> changes. Then</p>
            {eq(R`\mathrm{RS}_t = \frac{\overline{G}_t}{\overline{D}_t}, \qquad \mathrm{RSI}_t = 100 - \frac{100}{1 + \mathrm{RS}_t} \in [0, 100] .`)}
            <Remark title="Interpretation">
              The conventional thresholds are:
            </Remark>
            <Items>
              <li><M>{R`\mathrm{RSI} > 70`}</M>: overbought; the price may have risen too fast.</li>
              <li><M>{R`\mathrm{RSI} < 30`}</M>: oversold; the price may have fallen too fast.</li>
              <li>Crossing 50 from below (above) indicates bullish (bearish) momentum.</li>
            </Items>
            <Remark>
              In strong trends RSI can stay beyond 70 or below 30 for long periods, so extreme readings alone are
              not exit signals. A <span className="italic">divergence</span>, where price makes a new high but
              RSI does not, is often a more informative early warning.
            </Remark>
          </Section>

          {/* 5 MACD */}
          <Section n="5" id="macd" title="Moving Average Convergence Divergence">
            <Definition n="5.1" name="MACD">
              Using the exponential moving averages of Definition 2.2,
            </Definition>
            {eq(R`\mathrm{MACD}_t = \mathrm{EMA}_{12}(t) - \mathrm{EMA}_{26}(t),`)}
            {eq(R`\mathrm{Signal}_t = \mathrm{EMA}_{9}\!\left(\mathrm{MACD}\right)(t), \qquad \mathrm{Hist}_t = \mathrm{MACD}_t - \mathrm{Signal}_t .`)}
            <Remark title="Interpretation">
              The MACD line crossing above its signal line is a bullish crossover, and crossing below is bearish.
              A growing histogram shows momentum building in the direction of the bars. A cross of the MACD line
              through zero means <M>{R`\mathrm{EMA}_{12}`}</M> and <M>{R`\mathrm{EMA}_{26}`}</M> have swapped order,
              a stronger confirmation of a trend change than a signal-line crossover.
            </Remark>
            <Remark>
              As a difference of smoothed series, MACD lags price and generates many false crossovers in choppy
              markets. It is most reliable on daily and weekly bars.
            </Remark>
          </Section>

          {/* 6 VWAP */}
          <Section n="6" id="vwap" title="Volume-Weighted Average Price">
            <Definition n="6.1" name="VWAP">
              Let the typical price be <M>{R`\tilde P_t = (H_t + L_t + P_t)/3`}</M> and let <M>{R`\mathcal{S}(t)`}</M> be
              the bars of the trading session containing <M>{R`t`}</M>, up to and including <M>{R`t`}</M>. Then
            </Definition>
            {eq(R`\mathrm{VWAP}_t = \frac{\sum_{s \in \mathcal{S}(t)} \tilde P_s V_s}{\sum_{s \in \mathcal{S}(t)} V_s} .`)}
            <p>
              On hourly bars the sum resets at each session. On daily bars, where a session is a single bar,
              charts use a rolling 20-bar window in place of <M>{R`\mathcal{S}(t)`}</M>.
            </p>
            <Remark title="Interpretation">
              VWAP is the average price paid per share, and institutions use it as an execution benchmark. Price
              above VWAP suggests buyers are in control; below, sellers. Intraday, price often reverts to VWAP,
              which then acts as support or resistance.
            </Remark>
            <Remark>
              A few large prints can distort VWAP for thinly traded names, and it becomes less informative as the
              session ages.
            </Remark>
          </Section>

          {/* 7 Risk */}
          <Section n="7" id="risk" title="Risk and Return Metrics">
            <p>
              The quantities in this section and the next are stored per bar in the feature table. Each uses the
              last <M>{R`n = 195`}</M> hourly returns and the annualization factor <M>{R`A`}</M> of equation (2).
              Write <M>{R`e_t = r_t - r_f/A`}</M> for the excess return.
            </p>

            <Subsection n="7.1" title="Volatility">
              {eq(R`\sigma_{\text{ann}} = \sqrt{A}\; s(r) .`)}
              <p>The annualized standard deviation of returns: the typical size of a year's move, in percent.</p>
            </Subsection>

            <Subsection n="7.2" title="Sharpe ratio">
              {eq(R`\mathrm{Sharpe} = \sqrt{A}\; \frac{\overline{e}}{s(r)} .`)}
              <p>Excess return earned per unit of total risk. Values above 1 are generally considered good.</p>
            </Subsection>

            <Subsection n="7.3" title="Sortino ratio">
              <p>Let <M>{R`\mathcal{D} = \{ i : e_{t-i} < 0 \}`}</M> be the bars with negative excess return, and</p>
              {eq(R`\delta = \sqrt{ \frac{1}{|\mathcal{D}|} \sum_{i \in \mathcal{D}} e_{t-i}^2 }, \qquad \mathrm{Sortino} = \sqrt{A}\; \frac{\overline{e}}{\delta} .`)}
              <p>Like Sharpe, but only downside deviation counts as risk, so upside volatility is not penalized.</p>
            </Subsection>

            <Subsection n="7.4" title="Maximum drawdown">
              <p>With wealth index <M>{R`W_j = \prod_{i \le j} (1 + r_i)`}</M> over the window,</p>
              {eq(R`\mathrm{MDD} = \min_j \frac{W_j - \max_{i \le j} W_i}{\max_{i \le j} W_i} \;\le\; 0 .`)}
              <p>The worst peak-to-trough loss in the window. Values closer to zero are better.</p>
            </Subsection>

            <Subsection n="7.5" title="Value at risk">
              <p>Under a Gaussian approximation of hourly returns,</p>
              {eq(R`\mathrm{VaR}_{95} = \overline{r} + s(r)\,\Phi^{-1}(0.05) \approx \overline{r} - 1.645\, s(r),`)}
              <p>
                where <M>{R`\Phi`}</M> is the standard normal CDF: one hour in twenty is expected to be worse
                than this return.
              </p>
              <Remark>
                Return distributions have fatter tails than the normal (see 7.6), so parametric VaR tends to
                understate extreme losses.
              </Remark>
            </Subsection>

            <Subsection n="7.6" title="Skewness and kurtosis">
              <p>With central moments <M>{R`\mu_k = \tfrac{1}{n}\sum_i (r_{t-i} - \overline{r})^k`}</M>,</p>
              {eq(R`\gamma_1 = \frac{\mu_3}{\mu_2^{3/2}}, \qquad \gamma_2 = \frac{\mu_4}{\mu_2^{2}} - 3 .`)}
              <p>
                Negative skewness means large losses are more common than large gains. The excess kurtosis
                <M>{R`\;\gamma_2`}</M> is zero for a normal distribution; positive values indicate fat tails.
              </p>
            </Subsection>
          </Section>

          {/* 8 Market-relative */}
          <Section n="8" id="market" title="Market-Relative Metrics">
            <Subsection n="8.1" title="Beta, correlation and R²">
              {eq(R`\beta = \frac{\operatorname{Cov}(r, m)}{\operatorname{Var}(m)}, \qquad \rho = \operatorname{Corr}(r, m), \qquad R^2 = \rho^2 .`)}
              <p>
                <M>{R`\beta`}</M> measures sensitivity to the market: <M>{R`\beta = 1.5`}</M> means the stock moves
                about 1.5% for a 1% index move. <M>{R`R^2`}</M> is the share of the stock's variance explained
                by the market, and indicates how meaningful <M>{R`\beta`}</M> is.
              </p>
            </Subsection>

            <Subsection n="8.2" title="Jensen's alpha">
              {eq(R`\alpha = A \left[ \left(\overline{r} - \frac{r_f}{A}\right) - \beta \left(\overline{m} - \frac{r_f}{A}\right) \right] .`)}
              <p>
                The annualized return in excess of what the CAPM predicts for the stock's level of market risk.
                Both legs use excess returns; omitting <M>{R`r_f`}</M> would bias <M>{R`\alpha`}</M> by
                <M>{R`\; r_f(\beta - 1)`}</M>.
              </p>
            </Subsection>

            <Subsection n="8.3" title="Information ratio">
              {eq(R`\mathrm{IR} = \sqrt{A}\; \frac{\overline{r - m}}{s(r - m)} .`)}
              <p>
                Active return over the index per unit of tracking error: how consistently the stock outperforms
                the market, rather than by how much.
              </p>
            </Subsection>
          </Section>

          <hr className="mt-14 mb-4 border-gray-300" />
          <p className="text-[0.85rem] text-gray-600">
            Chart overlays are computed in the browser from the plotted bars; stored metrics are produced by the
            feature pipeline. None of the quantities above is investment advice.
          </p>
        </article>
      </main>
    </div>
  )
}
