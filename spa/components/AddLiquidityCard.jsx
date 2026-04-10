var AddLiquidityCard = React.createClass({
    getInitialState: function() {
        return {
            amount: "0",
            subject: "",
            showSubject: false
        };
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
                            <div className="muted-2">{invalidSubject ? "Enter a valid Ethereum address." : "An empty or zero address uses your wallet. Deposits for another wallet require owner or referral authorization. Tokens are paid from your wallet."}</div>
                        </div> : null}
                        <div className="muted-2">{this.props.isOwner ? "No entry fee for owner deposits." : forAnother ? "Supply fee: 3% to the owner and 3% to you as the referral. The beneficiary receives the remaining 94%." : "Supply fee: 6% to the owner."}</div>
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
