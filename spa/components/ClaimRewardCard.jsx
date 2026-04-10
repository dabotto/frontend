var ClaimRewardCard = React.createClass({
    formatDate(date, varOrder) {
        varOrder = Array.isArray(varOrder = varOrder || ["day", "hour", "minute"]) ? varOrder : [varOrder];
        var varName;
        var varValue = 0;
        for(var n of varOrder) {
            var v = date[n + "s"];
            if(v != 0) {
                varName = n;
                varValue = v;
                break;
            }
        }
        if(varValue === 0) {
            return "";
        }

        return varValue + " " + varName + (varValue === 1 ? "" : "s");
    },
    formatStartDate(startDate) {
        var message = this.formatDate(startDate);
        return message ? (message + " ago") : "";
    },
    formatEoyDate(eoyDate) {
        return this.formatDate(eoyDate, "day") || "NOW";
    },
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
                    onClick = {() => this.props.onOpenPicker("claimReward")}
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
                                Monitoring started: {this.props.summary.monitorStart.targetDateFormatted}
                            </div>
                            <div className = "position-kpi-value">
                                {this.formatStartDate(this.props.summary.monitorStart)}
                            </div>
                            <br/>
                            <div className = "position-kpi-label">
                                (It will be set at the beginning of every year)
                            </div>
                        </div>
                    </div>

                    <br/>

                    <div className = "position-kpi-grid">

                        <div className = {
                            "position-kpi-card " +
                            (this.props.summary?.stillInvested === '0' ? "position-pnl-positive" : "position-pnl-negative")
                        }>
                            <div className = "position-kpi-label">
                                Still invested
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.stillInvested} {token?.symbol}
                            </div>
                        </div>

                        <div className = "position-kpi-card">
                            <div className = "position-kpi-label">
                                Actual heritage
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.heritageValue} {token?.symbol}
                            </div>
                        </div>

                        <div className = "position-kpi-card">
                            <div className = "position-kpi-label">
                                Fees accruing
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.toBeCollected} {token?.symbol}
                            </div>
                        </div>
                    </div>
                </>}
                {!claimableValue || claimableValue === '0' ? null : <>
                    <div className = "metric-card">
                        <div className = "metric-label">
                            Claimable Fees
                        </div>
                        <div className = "big-value">
                            {claimableValue ? fromDecimals(claimableValue, token.decimals, true) + " " + token.symbol : "--"}
                        </div>
                        <div className = "claim-reward-button-container">
                            <button className = "button-base button-primary" disabled={!token || !claimableValue} onClick={this.props.onClaimReward}>
                                {token ? "Claim" : "Select a token first"}
                            </button>
                        </div>
                    </div>
                </>}
                {!this.props.summary ? null : <>
                    <br/>
                    <div className = "position-kpi-grid">

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

                        <div className = "position-kpi-card">
                            <div className = "position-kpi-label">
                                {this.props.summary.accruingResetDate ? 'Accruing reset date: ' + this.props.summary.monitorEnd : 'Last monitor update:'}
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.accruingResetDate || this.props.summary.monitorEnd}
                            </div>
                        </div>

                        <div className = "position-kpi-card">
                            <div className = "position-kpi-label">
                                Claimed fees
                            </div>
                            <div className = "position-kpi-value">
                                {this.props.summary.alreadyCollected} {token?.symbol}
                            </div>
                        </div>
                    </div>

                    <div className = "position-collecting-box">                            
                        <div className = "position-kpi-label">
                            Run rate forecast:
                        </div>
                        <div className = "position-collecting-head">
                            <div className = "position-kpi-label position-kpi-config">
                                <div className="position-kpi-config-element">
                                    <label>
                                        <input type="checkbox" checked={this.props.forecastIn12Months} onChange={this.props.toggleForecastIn12Months} />
                                        {"\u00a0"}
                                        <span>In 12 months</span>
                                    </label>
                                </div>
                                {!this.props.isOwner ? null : <div className="position-kpi-config-element">
                                    <label>
                                        <input type="checkbox" checked={this.props.net} onChange={this.props.toggleNet} />
                                        {"\u00a0"}
                                        <span>net</span>
                                    </label>
                                </div>}
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
                                    <div className = "position-collecting-item-label">{this.props.forecastIn12Months ? "Yearly" : ("EOY (" + this.formatEoyDate(this.props.summary.eoy) + ")")}</div>
                                    <div className = "position-collecting-item-value">{this.props.summary.collectYear} {token?.symbol}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>}
            </div>
        );
    }
});