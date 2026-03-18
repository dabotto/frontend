var AddLiquidityCard = React.createClass({
    getInitialState: function() {
        return {
            amount: "0",
            subject: "",
            showSubject: false,
            forecast: null,
            forecastStatus: ""
        };
    },
    componentDidMount: function() {
        this.refreshForecast();
    },
    componentDidUpdate: function(previousProps, previousState) {
        if(previousProps.token?.address !== this.props.token?.address || previousProps.referenceToken?.address !== this.props.referenceToken?.address || previousProps.allowance !== this.props.allowance || previousState.amount !== this.state.amount || previousState.subject !== this.state.subject || previousState.showSubject !== this.state.showSubject) {
            this.refreshForecast();
        }
    },
    componentWillUnmount: function() {
        clearTimeout(this.forecastTimeout);
        this.forecastRequest++;
    },
    refreshForecast: function() {
        clearTimeout(this.forecastTimeout);
        var request = this.forecastRequest = (this.forecastRequest || 0) + 1;
        var token = this.props.token;
        var reference = this.props.referenceToken;
        var subject = this.state.showSubject ? this.state.subject.trim() : "";
        var amount = this.state.amount;
        if(!token || !reference || !this.props.walletAddress || amount === "." || (subject && !web3utils.isAddress(subject))) {
            return this.setState({ forecast: null, forecastStatus: "" });
        }
        this.setState({ forecast: null, forecastStatus: "Loading estimate…" });
        this.forecastTimeout = setTimeout(async () => {
            try {
                var forecast = await this.props.estimateRewards(token.address, toDecimals(amount || "0", token.decimals), subject, reference.address);
                if(request === this.forecastRequest) this.setState({ forecast, forecastStatus: "" });
            } catch(e) {
                if(request === this.forecastRequest) this.setState({ forecastStatus: "Estimate unavailable with the current deposit or reward history." });
            }
        }, 350);
    },
    renderForecast: function(invalidSubject) {
        var forecast = this.state.forecast;
        var symbol = this.props.referenceToken?.symbol;
        var formatDate = timestamp => new Date(timestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
        return <section className = "field-shell form-stack liquidity-forecast" aria-label = "Projected portfolio value">
            <h4 className = "liquidity-forecast-title">Projected portfolio value</h4>
            {forecast ? <>
                <div className = "liquidity-forecast-capital">
                    <div>
                        <div className = "runrate-label">Starting portfolio value</div>
                        <div className = "liquidity-forecast-value">{forecast.startingValue} <small>{symbol}</small></div>
                    </div>
                    <div>
                        <div className = "runrate-label">Gain / loss already reflected</div>
                        <div className = {"runrate-value" + (forecast.capitalLoss ? " is-negative" : "")}>{forecast.capitalResult} <small>{symbol}</small></div>
                    </div>
                </div>
                <div className = "runrate-note">
                    Participation: <strong>{forecast.currentParticipation}% now</strong> · <strong>{forecast.projectedParticipation}% after deposit</strong>
                    {forecast.alreadyFullShare ? <div>This wallet already receives 100% of protocol rewards. A larger deposit increases the projected capital value, while projected rewards stay the same.</div> : null}
                </div>
                <div className = "runrate-grid">
                    {forecast.estimates.map(item => <div key = {item.months} className = {"runrate-item" + (item.months === 12 ? " liquidity-forecast-year" : "")}>
                        <div className = "runrate-label">{item.months} months</div>
                        <div className = "runrate-value">{item.value} <small>{symbol}</small></div>
                        <div className = "runrate-note">
                            Projected rewards <strong>{item.grossRewards} {symbol}</strong>
                            {item.roi !== null && <strong className = "liquidity-forecast-roi">({item.roi}% ROI)</strong>}
                        </div>
                        <div className = "liquidity-forecast-track" aria-hidden = "true"><span style = {{width: item.barWidth + "%"}} /></div>
                    </div>)}
                </div>
                <div className = "runrate-note">Starting portfolio value plus the credited deposit and estimated rewards. The estimate uses protocol rewards from {formatDate(forecast.start)} to {formatDate(forecast.end - 1)} UTC, the share after this deposit, and the ratio of the protocol’s current withdrawal value to its recorded capital when available.</div>
            </> : <div className = "runrate-note" role = "status">{invalidSubject ? "Enter a valid beneficiary address to estimate rewards." : this.state.forecastStatus || "Select a token and enter an amount to estimate rewards."}</div>}
            <p className = "liquidity-forecast-disclaimer"><i className = "fa-solid fa-circle-info" aria-hidden = "true"></i><span><strong>Projections are not guaranteed.</strong> Actual rewards may differ from these historical estimates.</span></p>
        </section>;
    },
    setMax: function() {
        var self = this;
        this.props.token && this.setState({ amount: parseFloat(fromDecimals(this.props.balance, this.props.token.decimals, true))}, self.props.refreshBalance);
    },
    handleAmountChange: function(e) {
        var value = e.target.value;
        if(/^\d*([.]\d*)?$/.test(value)) {
            this.setState({ amount: value });
        }
    },
    render: function() {
        var token = this.props.token;
        var balance = (token && this.props.balance) || "0";
        var allowance = (token && this.props.allowance) || '0';
        var isEth = token && token.symbol === "ETH";
        var approved = token && (isEth || this.props.approvedTokens[token.address]);
        approved = !token ? false : parseInt(allowance) >= parseInt(toDecimals(this.state.amount || 0, token.decimals, true));
        var approveDisabled = !token || isEth || approved;
        var amountValue = parseFloat(this.state.amount || "0");
        var addDisabled = !token || !this.state.amount || isNaN(amountValue) || amountValue <= 0 || (!isEth && !approved);
        var approvePrimary = token && !isEth && !approved;
        var subject = this.state.showSubject ? this.state.subject.trim() : '';
        var invalidSubject = subject && !web3utils.isAddress(subject);
        var forAnother = subject && !invalidSubject && subject.toLowerCase() !== voidEthereumAddress && subject.toLowerCase() !== this.props.walletAddress.toLowerCase();
        addDisabled = addDisabled || !!invalidSubject;
        return (
            <div style = {{ marginTop: "12px" }}>
                <div className = "card-header">
                    <div>
                        <h3 className = "card-title">Add liquidity</h3>
                        <div className = "card-copy">One token, one amount, one clear next step.</div>
                    </div>
                </div>
                <div className = "form-stack">
                    <div className="field-shell">
                        <label className="manager-subject-toggle">
                            <input type="checkbox" checked={this.state.showSubject} onChange={e => this.setState({showSubject: e.target.checked, subject: ''})} aria-controls="liquidity-subject-fields" aria-expanded={this.state.showSubject} />
                            <span>Deposit for another wallet</span>
                        </label>
                        {this.state.showSubject ? <div id="liquidity-subject-fields">
                            <label className="field-label" htmlFor="liquidity-subject">Beneficiary (optional)</label>
                            <input id="liquidity-subject" className="manager-address-input" type="text" placeholder="Empty = your wallet" value={this.state.subject} onChange={e => this.setState({subject: e.target.value})} aria-invalid={!!invalidSubject} />
                            <div className="muted-2">{invalidSubject ? "Enter a valid Ethereum address." : "An empty or zero address uses your wallet. Deposits for another wallet require protocol authorization. Tokens are paid from your wallet."}</div>
                        </div> : null}
                        <div className="muted-2">{this.props.isOwner ? "No entry fee applies to this deposit." : forAnother ? "Supply fee: 1.25% to the protocol and 1.25% to you as the referral. The beneficiary receives the remaining 97.5%." : "Standard supply fee: 2.5% to the protocol."}</div>
                    </div>
                    <button className = "select-token-button" onClick = {() => this.props.onOpenPicker("addLiquidity")}>
                        {token ? (
                            <>
                                <div className = "select-left">
                                    <div className = "token-avatar">{token.symbol.slice(0, 3)}</div>
                                    <div className = "token-meta">
                                        <div className = "token-name">{token.name}</div>
                                        <div className = "token-subline">{token.symbol} · {shortAddress(token.address)}</div>
                                    </div>
                                </div>
                                <i className = "fa-solid fa-chevron-down"></i>
                            </>
                        ) : (
                            <>
                                <div className = "select-left">
                                    <div className = "token-avatar"><i className = "fa-solid fa-coins"></i></div>
                                    <div className = "token-meta">
                                        <div className = "token-name">Select token</div>
                                        <div className = "token-subline">Choose the asset you want to add</div>
                                    </div>
                                </div>
                                <i className = "fa-solid fa-chevron-down"></i>
                            </>
                        )}
                    </button>
                    <div className = "field-shell primary-glow">
                        <div className = "field-label-row">
                            <div className = "field-label">Amount</div>
                            <button className = "max-chip" onClick = {this.setMax} disabled = {!token}>MAX</button>
                        </div>
                        <div className = "field-input-row">
                            <input
                                className = "amount-input"
                                type = "text"
                                inputMode = "decimal"
                                placeholder = "0.00"
                                value = {this.state.amount}
                                onChange = {this.handleAmountChange}
                            />
                            <div className = "token-chip">{token ? token.symbol : "TOKEN"}</div>
                        </div>
                    </div>
                    {this.renderForecast(invalidSubject)}
                    <div className = "balance-box">
                        <div className = "field-label">Available balance</div>
                        <div className = "kpi-value">{token ? balance ? (fromDecimals(balance, token.decimals, true) + " " + token.symbol) : "Loading balance..." : "Select a token first"}</div>
                    </div>
                    <div className = "kpi-row">
                        <div className = "kpi-item">
                            <div className = "kpi-label">Approval status</div>
                            <div className = "kpi-value">{!token ? "Waiting" : isEth ? "Not needed" : approved ? "Ready" : "Required"}</div>
                        </div>
                        <div className = "kpi-item">
                            <div className = "kpi-label">Next action</div>
                            <div className = "kpi-value">{!token ? "Pick token" : approvePrimary ? "Approve" : "Add liquidity"}</div>
                        </div>
                    </div>
                    {this.props.toast ? <div className = "status-pill success"><i className = "fa-solid fa-circle-check"></i>{this.props.toast}</div> : null}
                    <div className = "cta-row">
                        <button className = {"button-base " + (approvePrimary ? "button-primary" : "button-secondary")} disabled = {approveDisabled} onClick = {function() { this.props.onApprove(token.address, toDecimals(this.state.amount || '0', token.decimals)); }.bind(this)}>
                            <i className = "fa-solid fa-badge-check"></i>
                            Approve
                        </button>
                        <button onClick={() => this.props.onAddLiquidity(token.address, toDecimals(this.state.amount || '0', token.decimals), subject)} className = {"button-base " + (!approvePrimary ? "button-primary" : "button-secondary")} disabled = {addDisabled}>
                            <i className = "fa-solid fa-plus"></i>
                            Add Liquidity
                        </button>
                    </div>
                    <div className = "muted-2">Approve is skipped for ETH. For any other token, approval comes first when needed.</div>
                </div>
            </div>
        );
    }
});
