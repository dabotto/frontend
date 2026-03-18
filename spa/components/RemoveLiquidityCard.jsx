var RemoveLiquidityCard = React.createClass({
    renderSliderTicks(ref) {
        ref && ref.childNodes.forEach(a => {
            a.href = "javascript:void(0)";
            a.onclick = () => this.props.onRemoveLiquidity(this.props.token.address, a.innerText.split('%').join('').trim(), true);
        });
    },
    render: function() {
        var token = this.props.token;
        var percent = this.props.percent;
        var quote = token && this.props.withdrawalQuote;
        var hasSelection = parseFloat(percent) > 0;
        var formatAmount = value => fromDecimals(value.toString(), token.decimals, true) + " " + token.symbol;
        var total = !hasSelection ? "--" : !quote ? "Loading..." : formatAmount(web3utils.toBN(quote.capital).add(web3utils.toBN(quote.reward)));
        return (
            <div style = {{ marginTop: "12px" }}>
                <div className = "card-header">
                    <div>
                        <h3 className = "card-title">Remove liquidity</h3>
                        <div className = "card-copy">Use the slider to pick exactly how much you want to remove.</div>
                    </div>
                </div>
                <div className = "form-stack">
                    {token ? <>
                        <div className = "balance-box">
                            <div className = "slider-wrap">
                                <div className = "slider-head">
                                    <div>
                                        <div className = "field-label">Removal amount</div>
                                        <div className = "muted">Move the slider until the value feels right.</div>
                                    </div>
                                    <div className = "percent-value">{percent}%</div>
                                </div>
                                <input
                                    type = "range"
                                    min = "0"
                                    max = "100"
                                    step = "0.01"
                                    value = {percent}
                                    style = {{ "--slider-fill": percent + "%" }}
                                    onChange = {e => this.props.onRemoveLiquidity(this.props.token.address, e.target.value, true)}
                                />
                                <div className = "slider-ticks" ref={this.renderSliderTicks}>
                                    <a>0%</a>
                                    <a>25%</a>
                                    <a>50%</a>
                                    <a>75%</a>
                                    <a>100%</a>
                                </div>
                            </div>
                        </div>
                        <div className = "receive-box">
                            <div className = "field-label">You will receive</div>
                            <div className = "kpi-value" style = {{ marginTop: "8px" }}>{total}</div>
                            {hasSelection && quote ? <div className = "muted">
                                <div>Capital {formatAmount(quote.capital)}</div>
                                <div>Accrued rewards {formatAmount(quote.reward)}</div>
                            </div> : null}
                        </div>
                        <button className = "button-base button-primary" onClick={() => this.props.onRemoveLiquidity(token.address, percent)} disabled = {!hasSelection || !quote}>
                            <i className = "fa-solid fa-minus"></i>
                            Remove Liquidity
                        </button>
                    </> : null}
                </div>
            </div>
        );
    }
});
