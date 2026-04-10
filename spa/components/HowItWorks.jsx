var HowItWorks = React.createClass({
    render() {
        return (
            <div className = "glass-card card-pad">
                <div className = "card-header">
                    <div>
                        <section>
                            <header>
                                <h2>How It Works</h2>
                                <p>
                                    Deposit almost anything. The system does the hard stuff.
                                </p>
                                <p>
                                    This product automatically manages multiple concentrated liquidity positions across several onchain pools, deploying the shared treasury across a diversified universe of high-liquidity onchain assets.
                                </p>
                                <p>
                                    The strategy is not limited to crypto majors like WETH, cbBTC and SOL, or stable assets such as USDC and EURC. It also allocates capital across major <strong>onchain stocks</strong>, bringing some of the world's most recognizable publicly traded companies into the same onchain investment infrastructure.
                                </p>
                                <p>
                                    That investment universe can include companies such as <strong>NVDA, MSTR, GOOGL, AAPL, TSLA, META, MSFT, SPCX and AMZN</strong>, alongside major crypto assets and stablecoins.
                                </p>
                                <p>
                                    The core accounting unit is <strong>USDC</strong>. That means all internal calculations, proportions and share logic are normalized against USDC, making USDC the strategy’s native reference asset regardless of which underlying assets the treasury is currently managing.
                                </p>
                            </header>
                        </section>

                        <section>
                            <h3>What the system does behind the scenes</h3>
                            <ul>
                                <li>Aggregates multiple liquidity positions into one shared on-chain treasury.</li>
                                <li>Diversifies treasury deployment across crypto majors, stable assets and leading onchain stocks.</li>
                                <li>Deploys very tight liquidity curves designed to extract high trading fees.</li>
                                <li>Actively manages position composition through strategic swaps and liquidity adjustments.</li>
                                <li>Continuously works to offset price-driven capital deterioration with fee generation and automated position management.</li>
                                <li>Automatically reallocates capital between supported markets when treasury composition needs to be adjusted.</li>
                                <li>Distributes the fee surplus to participants through recurring farming seasons.</li>
                            </ul>
                        </section>

                        <section>
                            <h3>Why this setup exists</h3>
                            <p>
                                Instead of forcing participants to manually choose assets, pairs, ranges, stock exposure, rebalance positions, or manage token composition, the system handles all execution logic on-chain.
                            </p>
                            <p>
                                The treasury can operate across multiple asset classes at the same time, combining exposure to major crypto assets, stablecoins and onchain equities within a single managed strategy.
                            </p>
                            <p>
                                The end result is simple:
                            </p>
                            <ul>
                                <li>You bring the asset.</li>
                                <li>The strategy routes it into the shared treasury.</li>
                                <li>The treasury distributes capital across its supported investment universe.</li>
                                <li>The treasury runs the positioning and liquidity management logic.</li>
                                <li>You keep your proportional exposure to the treasury and your share of the season output.</li>
                            </ul>
                        </section>

                        <section>
                            <h3>The Investment Universe</h3>
                            <p>
                                The Investment Manager is designed to operate across a broad onchain market rather than relying on a single token, pair or asset class.
                            </p>
                            <p>
                                Treasury capital can be deployed across three major categories:
                            </p>
                            <ul>
                                <li>
                                    <strong>Crypto majors</strong> — assets such as ETH, BTC and SOL.
                                </li>
                                <li>
                                    <strong>Stable assets</strong> — primarily USDC and EURC.
                                </li>
                                <li>
                                    <strong>Onchain stocks</strong> — tokenized exposure to major publicly traded companies such as NVDA, MSTR, GOOGL, AAPL, TSLA, META, MSFT, SPCX and AMZN.
                                </li>
                            </ul>
                            <p>
                                This allows the treasury to spread its activity across crypto markets and traditional-equity exposure while keeping the entire execution layer onchain.
                            </p>
                            <p>
                                Individual supported assets may evolve over time depending on available liquidity, market infrastructure and eligible v3-style pools.
                            </p>
                        </section>

                        <section>
                            <h3>Add Liquidity</h3>
                            <p>
                                You can enter using <strong>any token</strong>, as long as it has deep enough liquidity in a WETH pair on a major v3-style venue.
                            </p>
                            <p>
                                That includes standard assets like ETH, WETH, USDC or SOL, but also more exotic tokens if the required exit and routing liquidity is strong enough.
                            </p>
                            <p>
                                Your deposit asset does not need to match the assets currently managed by the treasury. The system handles the conversion and allocation process automatically, allowing a single deposit to participate in a strategy spanning crypto majors, stable assets and onchain stocks.
                            </p>
                            <p>
                                <strong>Important: Add Liquidity is no longer immediate.</strong>
                            </p>
                            <p>
                                Because of the Fusaka upgrade and its severely reduced gas allowance per transaction, the original single-transaction architecture could no longer execute the full allocation flow reliably.
                                This was not an optional design choice, and frankly it was not a change we wanted to make.
                                The network-level restriction forced a substantial architectural rewrite of the deposit pipeline, splitting what was previously handled immediately into a staged execution process.
                            </p>
                            <p>
                                As a result, once funds are sent, the system may require approximately <strong>10 minutes</strong> before the deposit is fully processed and inserted into the active treasury circuit.
                                Your funds are not lost or idle because of some arbitrary protocol rule: this delay exists because the Fusaka gas-limit reduction made the previous execution model technically impossible to preserve as-is.
                            </p>
                            <ul>
                                <li>Your deposit is converted and integrated into the shared treasury automatically.</li>
                                <li>You do not need to match pairs.</li>
                                <li>You do not need to manually buy the underlying treasury assets.</li>
                                <li>You do not need to choose individual stocks.</li>
                                <li>You do not need to choose ranges.</li>
                                <li>You do not need to manage rebalancing.</li>
                                <li>Once the staged deposit process is completed, you start participating according to your treasury share.</li>
                            </ul>
                            <p>
                                The <strong>entry fee is now 6%</strong>.
                            </p>
                            <p>
                                This was not introduced because we suddenly decided to make deposits more expensive.
                                The Fusaka upgrade dramatically constrained the amount of gas available per transaction, forcing a much heavier execution architecture and materially increasing the transaction overhead required to make the system work at all.
                            </p>
                            <p>
                                In practical terms: a network change reduced the execution room available to complex on-chain systems, and the protocol had to absorb that decision by redesigning the architecture around it.
                                The 6% entry fee reflects the additional transaction cost and execution burden created by that constraint.
                                We would obviously prefer the old architecture, the old execution path and the old fee.
                                Unfortunately, pretending the gas-limit reduction did not happen would simply result in failed transactions and a system that no longer works.
                            </p>
                        </section>

                        <section>
                            <h3>Remove Liquidity</h3>
                            <p>
                                You can exit partially or fully at any time.
                            </p>
                            <p>
                                <strong>Unlike Add Liquidity, Remove Liquidity is not subject to the Fusaka-related processing delay.</strong>
                                For now, withdrawals remain immediately executable through the normal flow.
                            </p>
                            <p>
                                The interface includes a <strong>0% to 100%</strong> extraction slider, so you can choose exactly how much of your current treasury share to pull out.
                            </p>
                            <ul>
                                <li>No exit fee.</li>
                                <li>No lockups.</li>
                                <li>No waiting period.</li>
                                <li>Output can be requested in the token you want, using the same routing logic as deposits.</li>
                            </ul>
                            <p>
                                When you exit, you do not need to manually unwind the individual crypto, stablecoin or onchain-stock positions held by the treasury. The system calculates your proportional share and handles the required liquidity movements and conversions automatically.
                            </p>
                            <p>
                                The amount shown in the frontend is the exact amount you receive. The conversion path and output are already calculated before execution, so there is no guesswork on your side.
                            </p>
                        </section>

                        <section>
                            <h3>Claim Reward</h3>
                            <p>
                                Rewards can be claimed at any time, independently from your treasury position.
                            </p>
                            <p>
                                <strong>Claims are not affected by the Fusaka-related Add Liquidity delay.</strong>
                                Claim execution remains available through the normal immediate flow.
                            </p>
                            <ul>
                                <li>No claim fee.</li>
                                <li>Claim does not reduce your principal share.</li>
                                <li>Claim output can be requested in the token you want, using the same automatic routing logic.</li>
                                <li>Unclaimed rewards remain claimable indefinitely.</li>
                            </ul>
                            <p>
                                The system only distributes the <strong>surplus fees</strong> generated beyond what is needed for internal position management.
                            </p>
                            <p>
                                Fees may originate from activity across any of the markets managed by the treasury, including crypto, stablecoin and onchain-stock liquidity positions.
                            </p>
                        </section>

                        <section>
                            <h3>Season Mechanics</h3>
                            <p>
                                Rewards are organized into discrete <strong>60-minute seasons</strong>.
                            </p>
                            <p>
                                This is not random. It exists to reduce whale abuse.
                            </p>
                            <ul>
                                <li>If someone enters late with oversized size, they only participate in the remaining fraction of the current season.</li>
                                <li>This makes it harder to jump in at the last second and siphon value away from smaller participants.</li>
                                <li>Every add, remove or claim action forces settlement of the current season before continuing.</li>
                                <li>Once settled, a new season starts from the updated treasury state.</li>
                            </ul>
                            <p>
                                In short: season boundaries keep the game cleaner, fairer and harder to cheese.
                            </p>
                        </section>

                        <section>
                            <h3>Participation Logic</h3>
                            <ul>
                                <li>Your position is based on your proportional share of the shared treasury.</li>
                                <li>Your exposure therefore represents a proportional participation in the treasury as a whole, rather than ownership of one specific internal position.</li>
                                <li>Your season output is calculated pro-rata against the portion of the season during which your share was active.</li>
                                <li>Entering mid-season means you only earn for the remaining part of that season.</li>
                                <li>Removing liquidity updates your treasury share, but does not erase already accrued claimable rewards.</li>
                                <li>Claiming rewards only pulls out rewards, not your treasury position.</li>
                            </ul>
                        </section>

                        <section>
                            <h3>What makes the UX simple</h3>
                            <ul>
                                <li>Single entry flow.</li>
                                <li>Single remove flow.</li>
                                <li>Single claim flow.</li>
                                <li>No pair balancing by hand.</li>
                                <li>No manual asset allocation.</li>
                                <li>No manual stock selection required.</li>
                                <li>No manual range picking.</li>
                                <li>No manual rebalancing.</li>
                                <li>No need to separately manage crypto and equity exposure.</li>
                                <li>No need to understand the full internal routing logic to use it.</li>
                            </ul>
                            <p>
                                The whole point is simple: <strong>you deposit anything, the system does the hard stuff</strong>.
                            </p>
                        </section>

                        <section>
                            <h3>FAQ</h3>


                            <details>
                                <summary>Why is the entry fee 6%?</summary>
                                <p>
                                    Because the Fusaka upgrade severely reduced the gas allowance available per transaction, the original deposit architecture could no longer execute the complete allocation flow reliably in a single transaction.
                                </p>
                                <p>
                                    This forced a major architectural rewrite and increased the transaction overhead required to operate the strategy. The higher fee is therefore a direct consequence of the additional execution cost created by that network-level limitation, not an arbitrary protocol pricing decision.
                                </p>
                            </details>

                            <details>
                                <summary>Why does Add Liquidity take around 10 minutes now?</summary>
                                <p>
                                    Again, because of Fusaka. The reduced gas allowance per transaction forced the deposit workflow to be split into a staged execution process instead of completing everything immediately.
                                </p>
                                <p>
                                    After you send funds, the system may therefore need approximately 10 minutes to complete all required processing and fully insert your capital into the active treasury circuit.
                                </p>
                            </details>

                            <details>
                                <summary>Does the 10-minute delay also affect Remove Liquidity or Claim?</summary>
                                <p>
                                    No. The Fusaka-related staging requirement applies to Add Liquidity only. Actually, Remove Liquidity and Claim are not subject to that processing delay and continue to use the normal immediate execution flow.
                                </p>
                            </details>

                            <details>
                                <summary>Can I really deposit any token?</summary>
                                <p>
                                    Yes, as long as that token has enough real liquidity in a WETH pair for the system to route it efficiently. If the frontend lets you proceed, the path has already been validated for execution.
                                </p>
                            </details>

                            <details>
                                <summary>Do I need to deposit both sides of a pair?</summary>
                                <p>
                                    No. One-sided entry is enough. The system handles conversion, distribution and positioning for you.
                                </p>
                            </details>

                            <details>
                                <summary>What assets does the treasury invest in?</summary>
                                <p>
                                    The treasury can deploy capital across major crypto assets such as ETH, BTC and SOL, stable assets such as USDC and EURC, and leading onchain stocks.
                                </p>
                                <p>
                                    Examples of supported equity exposure may include companies such as NVDA, MSTR, GOOGL, AAPL, TSLA, META, MSFT, SPCX and AMZN, depending on available liquidity and supported market infrastructure.
                                </p>
                            </details>

                            <details>
                                <summary>Do I need to choose which stocks or crypto assets the treasury buys?</summary>
                                <p>
                                    No. Your deposit gives you a proportional share of the managed treasury. Asset allocation, conversions, liquidity positioning and rebalancing are handled automatically by the system.
                                </p>
                            </details>

                            <details>
                                <summary>Am I investing only in crypto?</summary>
                                <p>
                                    No. The strategy is designed to operate across crypto majors, stable assets and onchain equities, allowing the treasury to diversify its activity across different types of markets while remaining entirely onchain.
                                </p>
                            </details>

                            <details>
                                <summary>Why is USDC treated as the native reference asset?</summary>
                                <p>
                                    Because all internal calculations, ratios and treasury accounting are normalized against USDC. It is the strategy’s calculation layer, even if you enter or exit with a different token and even when the treasury is managing crypto or onchain-stock positions.
                                </p>
                            </details>

                            <details>
                                <summary>Can I remove only part of my position?</summary>
                                <p>
                                    Yes. You can choose any percentage from 0% to 100% of your currently available treasury share.
                                </p>
                            </details>

                            <details>
                                <summary>Do rewards expire if I do not claim them?</summary>
                                <p>
                                    No. Rewards remain claimable indefinitely until you decide to withdraw them.
                                </p>
                            </details>

                            <details>
                                <summary>Why are seasons only 1 hour long?</summary>
                                <p>
                                    To make last-minute oversized entries less abusive. Short discrete seasons reduce the ability of larger players to jump in late and overcapture output that should belong to longer-standing smaller participants.
                                </p>
                            </details>

                            <details>
                                <summary>Do I need to manage swaps, ranges, stocks or liquidity moves myself?</summary>
                                <p>
                                    No. All execution logic is handled on-chain by the system. You only choose when to add, remove or claim.
                                </p>
                            </details>
                        </section>
                    </div>
                </div>
                <div className = "section-divider"></div>
                <button className = "button-base button-primary" onClick={this.props.onDismiss}>
                    <i className = "fa-solid fa-check"></i>
                    Got it
                </button>
            </div>
        );
    }
});