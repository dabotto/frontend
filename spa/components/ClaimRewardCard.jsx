var ClaimRewardCard = React.createClass({
    render: function() {
        var token = this.props.token;
        var claimableValue = this.props.claimableValue;
        return (
            <div className = "glass-card card-pad">
                <div className = "card-header">
                    <div>
                        <h2 className = "card-title">Your stats</h2>
                        <div className = "card-copy">
                            Monitor season progress and collect when ready.
                        </div>
                    </div>
                </div>
                <button
                    className = "select-token-button"
                    onClick = {function() {
                        this.props.onOpenPicker("claimReward");
                    }.bind(this)}
                >
                    {token ? (
                        <>
                            <div className = "select-left">
                                <div className = "token-avatar">
                                    {token.symbol.slice(0, 3)}
                                </div>
                                <div className = "token-meta">
                                    <div className = "token-name">
                                        {token.name}
                                    </div>
                                    <div className = "token-subline">
                                        {token.symbol} · {token.address.slice(0, 6)}...
                                    </div>
                                </div>
                            </div>
                            <i className = "fa-solid fa-chevron-down"></i>
                        </>
                    ) : (
                        <div className = "token-name">
                            Select reward token
                        </div>
                    )}
                </button>
                {!this.props.summary ? null : <>
                    <div className = "section-divider"></div>

                    <div className = "position-kpi-block">
                        <div className = "position-kpi-item">
                            <div className = "position-kpi-label">
                                Next season: {this.props.summary.nextSeasonDate}
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.nextSeasonTimeout}
                            </div>
                        </div>
                    </div>

                    <div className = "position-collecting-box">
                        <div className = "position-collecting-layout">
                            <div className = "position-collecting-now">
                                <div className = "position-collecting-now-label">Fees you're generating for the next season</div>
                                <div className = "position-collecting-now-value">{this.props.summary.collectNow} {token?.symbol}</div>
                            </div>
                        </div>
                        <div className = "position-collecting-head">
                            <div className = "position-kpi-label">
                                Projected fee run rate through year-end:
                            </div>
                        </div>

                        <div className = "position-collecting-layout">
                            <div className = "position-collecting-grid">
                                <div className = "position-collecting-item">
                                    <div className = "position-collecting-item-label">Daily</div>
                                    <div className = "position-collecting-item-value">{this.props.summary.collectDay} {token?.symbol}</div>
                                </div>
                                <div className = "position-collecting-item">
                                    <div className = "position-collecting-item-label">Weekly</div>
                                    <div className = "position-collecting-item-value">{this.props.summary.collectWeek} {token?.symbol}</div>
                                </div>
                                <div className = "position-collecting-item">
                                    <div className = "position-collecting-item-label">Monthly</div>
                                    <div className = "position-collecting-item-value">{this.props.summary.collectMonth} {token?.symbol}</div>
                                </div>
                                <div className = "position-collecting-item">
                                    <div className = "position-collecting-item-label">End of Year</div>
                                    <div className = "position-collecting-item-value">{this.props.summary.collectYear} {token?.symbol}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className = "section-divider"></div>

                    <div className = "position-kpi-grid">

                        <div className = "position-kpi-card">
                            <div className = "position-kpi-label">
                                Your participation
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.participationPercent}%
                            </div>
                        </div>

                        <div className = "position-kpi-card">
                            <div className = "position-kpi-label">
                                Your heritage
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.heritageValue} {token?.symbol}
                            </div>
                        </div>

                        <div className = {
                            "position-kpi-card " +
                            (this.props.summary.pnl === '0' ? "" : this.props.summary.pnl?.indexOf('-') === -1 ? "position-pnl-positive" : "position-pnl-negative")
                        }>
                            <div className = "position-kpi-label">
                                Profit and loss
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.pnl} {token?.symbol}
                            </div>
                        </div>

                    </div>
                </>}
                {!claimableValue || claimableValue === '0' ? null : <>
                    <div className = "metric-card">
                        <div className = "metric-label">
                            Claimable reward
                        </div>
                        <div className = "big-value">
                            {claimableValue ? fromDecimals(claimableValue, token.decimals, true) + " " + token.symbol : "--"}
                        </div>
                    </div>
                    <div className = "section-divider"></div>
                    <button className = "button-base button-primary" disabled={!token || !claimableValue} onClick={this.props.onClaimReward}>
                        <i className = "fa-solid fa-hand-holding-dollar"></i>
                        {token ? "Claim now" : "Select a token first"}
                    </button>
                </>}
            </div>
        );
    }
});