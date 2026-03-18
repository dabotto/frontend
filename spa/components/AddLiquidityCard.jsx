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
        if(previousProps.token?.address !== this.props.token?.address || previousProps.token?.decimals !== this.props.token?.decimals || previousProps.referenceToken?.address !== this.props.referenceToken?.address || previousProps.allowance !== this.props.allowance || previousState.amount !== this.state.amount || previousState.subject !== this.state.subject || previousState.showSubject !== this.state.showSubject) {
            this.refreshForecast();
        }
    },
    componentWillUnmount: function() {
        clearTimeout(this.forecastTimeout);
        clearTimeout(this.forecastDelayTimeout);
        this.forecastRequest++;
    },
    refreshForecast: function(keepPrevious) {
        clearTimeout(this.forecastTimeout);
        clearTimeout(this.forecastDelayTimeout);
        var request = this.forecastRequest = (this.forecastRequest || 0) + 1;
        var token = this.props.token;
        var reference = this.props.referenceToken;
        var subject = this.state.showSubject ? this.state.subject.trim() : "";
        var amount = this.state.amount;
        if(!token || !reference || !this.props.walletAddress || amount === "." || (subject && !web3utils.isAddress(subject))) {
            return this.setState({ forecast: null, forecastStatus: "" });
        }
        if (!keepPrevious || !this.state.forecast) {
            this.setState({ forecast: null, forecastStatus: "Loading estimate..." });
        }
        this.forecastTimeout = setTimeout(async () => {
            var delayTimeout = this.forecastDelayTimeout = setTimeout(() => {
                if(request === this.forecastRequest && !this.state.forecast) {
                    this.setState({ forecastStatus: "Reward data is taking longer than usual. If this continues, check RPC settings in Wallet." });
                }
            }, 20000);
            try {
                var forecast = await this.props.estimateRewards(token.address, this.amountInBaseUnits(amount, token.decimals), subject, reference.address);
                if(request === this.forecastRequest) this.setState({ forecast, forecastStatus: "" });
            } catch(e) {
                if(request === this.forecastRequest) this.setState({ forecast: null, forecastStatus: "Estimate unavailable with the current deposit or reward history." });
            } finally {
                clearTimeout(delayTimeout);
                if(request === this.forecastRequest) {
                    this.forecastTimeout = setTimeout(() => this.refreshForecast(true), 60000);
                }
            }
        }, keepPrevious ? 0 : 350);
    },
    renderForecast: function(invalidSubject) {
        var forecast = this.state.forecast;
        var symbol = this.props.referenceToken?.symbol;
        var formatDate = timestamp => new Date(timestamp * 1000).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
        return <section className = "field-shell form-stack liquidity-forecast" aria-label = "Portfolio scenario">
            <h4 className = "liquidity-forecast-title">Portfolio scenario</h4>
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
                {forecast.marketRatio === null ? <div className = "runrate-note">The scenario needs recorded protocol capital to calculate the market adjustment.</div> : <div className = "runrate-grid">
                    {forecast.estimates.map(item => <div key = {item.months} className = {"runrate-item" + (item.months === 12 ? " liquidity-forecast-year" : "")}>
                        <div className = "runrate-label">{item.months} months</div>
                        <div className = "runrate-value">{item.value} <small>{symbol}</small></div>
                        <div className = "runrate-note">
                            Projected rewards <strong>{item.rewards} {symbol}</strong>
                            {item.roi !== null && <strong className = "liquidity-forecast-roi">({item.roi}% ROI)</strong>}
                        </div>
                        <div className = "liquidity-forecast-track" aria-hidden = "true"><span style = {{width: item.barWidth + "%"}} /></div>
                    </div>)}
                </div>}
                {forecast.usesDepositQuote ? <div className = "runrate-note">The deposit estimate uses the protocol's conversion quote.</div> : null}
                {forecast.marketRatio === null ? null : <div className = "runrate-note">Projected rewards extrapolate the 28 days from {formatDate(forecast.start)} to {formatDate(forecast.end - 1)} UTC using your post-deposit share. They are scaled by {forecast.marketRatio}×, the protocol's current Heritage divided by its recorded invested capital. The separate annual Heritage scenario of {forecast.annualMultiplier}× drives future capital and average exposure. Scenario ROI is projected rewards divided by the starting portfolio value plus the credited deposit.</div>}
            </> : <div className = "runrate-note" role = "status">{invalidSubject ? "Enter a valid beneficiary address to estimate rewards." : this.state.forecastStatus || "Select a token and enter an amount to estimate rewards."}</div>}
            <p className = "liquidity-forecast-disclaimer"><i className = "fa-solid fa-circle-info" aria-hidden = "true"></i><span><strong>Projections are not guaranteed.</strong> Actual rewards may differ from these historical estimates.</span></p>
        </section>;
    },
    amountInBaseUnits: function(amount, decimals) {
        var [whole, fraction = ""] = amount.split(".");
        return (whole + fraction.slice(0, decimals).padEnd(decimals, "0")).replace(/^0+/, "") || "0";
    },
    formatBalance: function(value, decimals) {
        var digits = String(value).padStart(Number(decimals) + 1, "0");
        var point = digits.length - Number(decimals);
        var fraction = digits.slice(point).replace(/0+$/, "");
        return digits.slice(0, point) + (fraction ? "." + fraction : "");
    },
    setMax: function() {
        this.setState({ amount: this.formatBalance(this.props.balance, this.props.token.decimals) }, this.props.refreshBalance);
    },
    handleAmountChange: function(e) {
        var value = e.target.value;
        if(/^\d*([.]\d*)?$/.test(value)) {
            this.setState({ amount: value });
        }
    },
    render: function() {
        var token = this.props.token;
        var reference = this.props.referenceToken;
        var balance = this.props.balance;
        var allowance = this.props.allowance;
        var isEth = token && token.address.toLowerCase() === voidEthereumAddress;
        var amount = token ? this.amountInBaseUnits(this.state.amount, token.decimals) : "0";
        var amountValue = web3utils.toBN(amount);
        var hasBalance = balance != null && web3utils.toBN(String(balance)).gte(amountValue);
        var approved = allowance != null && web3utils.toBN(String(allowance)).gte(amountValue);
        var approvePrimary = token && !isEth && !approved;
        var canTransact = !!this.props.walletAddress && !!token && hasBalance && !amountValue.isZero();
        var approveDisabled = !canTransact || allowance == null || !approvePrimary;
        var subject = this.state.showSubject ? this.state.subject.trim() : '';
        var invalidSubject = subject && !web3utils.isAddress(subject);
        var forAnother = subject && !invalidSubject && subject.toLowerCase() !== voidEthereumAddress && subject.toLowerCase() !== this.props.walletAddress?.toLowerCase();
        var addDisabled = !canTransact || (!isEth && !approved) || !!invalidSubject;
        var showReferenceBalance = token && reference && token.address.toLowerCase() !== reference.address.toLowerCase();
        var balanceInReference = this.props.balanceInReference;
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
                            <button className = "max-chip" onClick = {this.setMax} disabled = {!token || balance == null}>MAX</button>
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
                    <div>
                        <div className = "balance-box">
                            <div className = "field-label">Available balance</div>
                            <div className = "kpi-value">{token ? balance != null ? (this.formatBalance(balance, token.decimals) + " " + token.symbol) : "Loading balance..." : "Select a token first"}</div>
                        </div>
                        {showReferenceBalance && balanceInReference != null ? <div className = "muted" style = {{ marginTop: "4px", paddingInline: "16px", fontSize: "var(--fs-lg)", fontWeight: 600 }}>≈ {formatMoney(this.formatBalance(balanceInReference, reference.decimals), 2)} {reference.symbol}</div> : null}
                    </div>
                    <div className = "kpi-row">
                        <div className = "kpi-item">
                            <div className = "kpi-label">Approval status</div>
                            <div className = "kpi-value">{!token ? "Waiting" : isEth ? "Not needed" : allowance == null ? "Waiting" : approved ? "Ready" : "Required"}</div>
                        </div>
                        <div className = "kpi-item">
                            <div className = "kpi-label">Next action</div>
                            <div className = "kpi-value">{!token ? "Pick token" : balance == null ? "Waiting" : !hasBalance ? "Insufficient balance" : approvePrimary ? "Approve" : "Add liquidity"}</div>
                        </div>
                    </div>
                    {this.props.toast ? <div className = "status-pill success"><i className = "fa-solid fa-circle-check"></i>{this.props.toast}</div> : null}
                    <div className = "cta-row">
                        <button className = {"button-base " + (approvePrimary ? "button-primary" : "button-secondary")} disabled = {approveDisabled} onClick = {() => this.props.onApprove(token.address, amount)}>
                            <i className = "fa-solid fa-badge-check"></i>
                            Approve
                        </button>
                        <button onClick={() => this.props.onAddLiquidity(token.address, amount, subject)} className = {"button-base " + (!approvePrimary ? "button-primary" : "button-secondary")} disabled = {addDisabled}>
                            <i className = "fa-solid fa-plus"></i>
                            Add Liquidity
                        </button>
                    </div>
                    {this.renderForecast(invalidSubject)}
                </div>
            </div>
        );
    }
});
