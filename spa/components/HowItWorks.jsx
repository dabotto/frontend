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
                                This product runs on Base and automatically manages multiple concentrated liquidity positions across several v3-style pools built around high-liquidity majors like WETH, USDC, EURC, cbBTC and SOL.
                            </p>
                            <p>
                                The core accounting unit is <strong>USDC</strong>. That means all internal calculations, proportions and share logic are normalized against USDC, making USDC the strategy’s native reference asset.
                            </p>
                        </header>
                    </section>

                    <section>
                        <h3>What the system does behind the scenes</h3>
                        <ul>
                            <li>Aggregates multiple liquidity positions into one shared on-chain treasury.</li>
                            <li>Deploys very tight liquidity curves designed to extract high trading fees.</li>
                            <li>Actively manages position composition through strategic swaps and liquidity adjustments.</li>
                            <li>Continuously works to offset price-driven capital deterioration with fee generation and automated position management.</li>
                            <li>Distributes the fee surplus to participants through recurring farming seasons.</li>
                        </ul>
                    </section>

                    <section>
                        <h3>Why this setup exists</h3>
                        <p>
                            Instead of forcing participants to manually choose ranges, rebalance positions, or manage token composition, the system handles all execution logic on-chain.
                        </p>
                        <p>
                            The end result is simple:
                        </p>
                        <ul>
                            <li>You bring the asset.</li>
                            <li>The strategy routes it into the shared treasury.</li>
                            <li>The treasury runs the positioning logic.</li>
                            <li>You keep your proportional exposure to the treasury and your share of the season output.</li>
                        </ul>
                    </section>

                    <section>
                        <h3>Add Liquidity</h3>
                        <p>
                            You can enter using <strong>any token</strong>, as long as it has deep enough liquidity in a WETH pair on a major v3-style venue.
                        </p>
                        <p>
                            That includes standard assets like ETH, WETH, USDC or SOL, but also more exotic tokens if the required exit and routing liquidity is strong enough.
                        </p>
                        <ul>
                            <li>Your deposit is converted and integrated into the shared treasury automatically.</li>
                            <li>You do not need to match pairs.</li>
                            <li>You do not need to choose ranges.</li>
                            <li>You do not need to manage rebalancing.</li>
                            <li>You immediately start participating according to your treasury share.</li>
                        </ul>
                        <p>
                            A <strong>2% entry fee</strong> is taken by the protocol when liquidity is added.
                        </p>
                    </section>

                    <section>
                        <h3>Remove Liquidity</h3>
                        <p>
                            You can exit partially or fully at any time.
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
                            The amount shown in the frontend is the exact amount you receive. The conversion path and output are already calculated before execution, so there is no guesswork on your side.
                        </p>
                    </section>

                    <section>
                        <h3>Claim Reward</h3>
                        <p>
                            Rewards can be claimed at any time, independently from your treasury position.
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
                            <li>No manual range picking.</li>
                            <li>No manual rebalancing.</li>
                            <li>No need to understand the full internal routing logic to use it.</li>
                        </ul>
                        <p>
                            The whole point is simple: <strong>you deposit anything, the system does the hard stuff</strong>.
                        </p>
                    </section>

                    <section>
                        <h3>FAQ</h3>

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
                            <summary>Why is USDC treated as the native reference asset?</summary>
                            <p>
                                Because all internal calculations, ratios and treasury accounting are normalized against USDC. It is the strategy’s calculation layer, even if you enter or exit with a different token.
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
                            <summary>Do I need to manage swaps, ranges or liquidity moves myself?</summary>
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