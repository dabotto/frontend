var PositionStatusSynopsis = React.createClass({
    getFixedStopPositions: function() {
        return {
            lowerBound: 8,
            positionPrice: 50,
            upperBound: 92
        };
    },
    getScoreClass: function(score) {
        if (score === 0) {
            return "position-score position-score-blue";
        }
        if (score === 1) {
            return "position-score position-score-green";
        }
        return "position-score position-score-red";
    },
    toNumber: function(value) {
        var n = Number(value);
        if (!isFinite(n)) {
            return 0;
        }
        return n;
    },
    formatValue: function(value) {
        var n = this.toNumber(value);
        if (Math.abs(n) >= 1000000) {
            return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
        }
        if (Math.abs(n) >= 1000) {
            return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
        }
        if (Math.abs(n) >= 1) {
            return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
        }
        return n.toLocaleString("en-US", { maximumFractionDigits: 8 });
    },
    getStops: function(item) {
        return !item.prices ? [] : [
            { key: "lowerBound", label: "Out", value: this.toNumber(item.prices[0]), kind: "edge" },
            { key: "positionPrice", label: "OK", value: this.toNumber(item.positionPrice), kind: "position" },
            { key: "upperBound", label: "Out", value: this.toNumber(item.prices[5]), kind: "edge" }
        ];
    },
    renderStop: function(stop, item) {
        var left = this.getPricePercent(stop.value, item);
        if(left === null) return null;
        return (
            <div key = {stop.key} className = {"position-stop position-stop-" + stop.kind} style = {{ left: left + "%" }}>
                <div className = "position-stop-line"></div>
                <div className = "position-stop-label">{stop.label}</div>
                <div className = "position-stop-value">{this.formatValue(stop.value)}</div>
            </div>
        );
    },
    getPricePercent: function(value, item) {
        if(!item.prices) return null;
        var positions = this.getFixedStopPositions();
        var price = Number(value);
        var first = Number(item.prices && item.prices[0]);
        var last = Number(item.prices && item.prices[5]);
        var center = Number(item.positionPrice);
        if(value === null || value === undefined || value === '' || !isFinite(price) || !isFinite(first) || !isFinite(last)) return null;
        var lower = Math.min(first, last);
        var upper = Math.max(first, last);
        if(lower === upper) return price === lower ? positions.positionPrice : price < lower ? positions.lowerBound : positions.upperBound;
        var min = lower, max = upper;
        var left = positions.lowerBound, right = positions.upperBound;
        if(center > lower && center < upper) {
            if(price <= center) { max = center; right = positions.positionPrice; }
            else { min = center; left = positions.positionPrice; }
        }
        var ratio = Math.max(0, Math.min(1, (price - min) / (max - min)));
        return left + (right - left) * ratio;
    },
    getCurrentPricePercent: function(item) {
        return this.getPricePercent(item.currentPrice, item);
    },
    renderCurrentPrice: function(item) {
        var currentPrice = this.toNumber(item.currentPrice);
        var left = this.getCurrentPricePercent(item);
        if(left === null) return null;
        return (
            <div className = "position-current-price" style = {{ left: left + "%" }}>
                <div className = "position-current-arrow">
                    <i className = "fa-solid fa-caret-down"></i>
                </div>
                <div className = "position-current-badge">{this.formatValue(currentPrice)}</div>
            </div>
        );
    },
    getScoreLabel: function(score) {
        if (score === 0) return "Collecting";
        if (Math.abs(score) === 1) return "in profit";
        if (Math.abs(score) === 2) return "unbalanced";
        return "unprofitable";
    },
    formatAmount(amount, decimals, symbol, spaces) {
        return (this.props.synopticConverted ? `${symbol}: ` : "") + formatMoney(fromDecimals(amount, this.props.synopticConverted ? this.props.token.decimals : decimals, true), spaces || 4) + " " + (this.props.synopticConverted ? this.props.token.symbol : symbol);
    },
    renderCard: function(item, index) {
        var score = item.statusResult;
        var stops = this.getStops(item);
        return (
            <div key = {item.poolAddress || index} className = "position-synopsis-card glass-card card-pad">
                <div className = "position-synopsis-head">
                    <div className = "position-synopsis-head-left">
                        <a
                            className = "position-address-link"
                            href = {"https://dexscreener.com/" + getAppNetwork().dexscreenerNetwork + "/" + item.poolAddress}
                            target = "_blank"
                            rel = "noreferrer"
                        >
                            {shortAddress(item.poolAddress)}
                            <i className = "fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                    </div>
                    <div className = "position-synopsis-head-right">
                        <span># {item.index}</span>
                        {'\u00a0'}
                        <div className = "position-pair-label"><a target="_blank" href={getEtherscanAddress("token/" + item.token0)}>{item.symbol0}</a> / <a target="_blank" href={getEtherscanAddress("token/" + item.token1)}>{item.symbol1}</a></div>
                        <div className = {this.getScoreClass(score)}>
                            <span className = "position-score-label">{this.getScoreLabel(score)}</span>
                        </div>
                    </div>
                </div>
                <div className = "position-synopsis-head">
                    <div className = "position-synopsis-head-left">
                        Fees: {this.formatAmount(item.feeAmount0, item.decimals0, item.symbol0, 6)} / {this.formatAmount(item.feeAmount1, item.decimals1, item.symbol1, 6)}
                        <br/>
                        <br/>
                        Available: {this.formatAmount(item.poolAmount0, item.decimals0, item.symbol0)} / {this.formatAmount(item.poolAmount1, item.decimals1, item.symbol1)}
                        <br/>
                        <br/>
                        Total: {this.formatAmount(item.token0Amount, item.decimals0, item.symbol0)} / {this.formatAmount(item.token1Amount, item.decimals1, item.symbol1)}
                        <br/>
                        <br/>
                        Original: {this.formatAmount(item.savedToken0Amount, item.decimals0, item.symbol0)} / {this.formatAmount(item.savedToken1Amount, item.decimals1, item.symbol1)}
                        <br/>
                        <br/>
                        {Math.abs(score) === 2 ? <>
                            Rebalanced: {this.formatAmount(item.after0, item.decimals0, item.symbol0)} / {this.formatAmount(item.after1, item.decimals1, item.symbol1)}
                            <br/>
                            <br/>
                        </> : null}
                        Difference: {this.formatAmount(item.difference0, item.decimals0, item.symbol0)} / {this.formatAmount(item.difference1, item.decimals1, item.symbol1)}
                        <br/>
                        <br/>
                        {Math.abs(score) !== 2 ? <>
                            Adjusted: {this.formatAmount(item.after0, item.decimals0, item.symbol0)} / {this.formatAmount(item.after1, item.decimals1, item.symbol1)}
                            <br/>
                            <br/>
                        </> : null}
                        Surplus: {this.formatAmount(item.surplus0, item.decimals0, item.symbol0)} / {this.formatAmount(item.surplus1, item.decimals1, item.symbol1)}
                    </div>
                </div>
                <div className = "position-chart-wrap">
                    <div className = "position-chart-grid"></div>
                    <div className = "position-chart-line"></div>
                    {stops.map(function(stop) {
                        return this.renderStop(stop, item);
                    }.bind(this))}
                    {this.renderCurrentPrice(item)}
                </div>
            </div>
        );
    },
    renderFeesToClaim() {
        var amount = this.props.items && this.props.items.reduce((acc, it) => web3.utils.toBN(acc).add(web3.utils.toBN(it.surplus0)).add(web3.utils.toBN(it.surplus1)).toString(), "0") || '0';
        return amount === '0' ? null : <div>
            Fees to claim: {formatMoney(fromDecimals(numberToString(parseFloat(amount) * 0.9).split('.')[0], this.props.token.decimals, true), 6)} {this.props.token.symbol}
        </div>
    },
    render() {
        return (
            <div className = "glass-card card-pad">
                <div className = "card-title">
                    Position status
                    {this.props.items && this.props.items.length > 0 ? <label style = {{ float: "right", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                        <input type="checkbox" checked={this.props.synopticConverted} onChange={this.props.toggleSynopticConverted}/>
                        <span>Convert amounts in {this.props.token.symbol}</span>
                    </label> : null}
                </div>
                <div className = "card-copy">{!this.props.items ? "Loading status of the positions..." : this.props.items.length === 0 ? "No positions to show" : "Let the bot automatically rebalance them or do it by yourself"}</div>
                {this.props.items && this.props.items.length > 0 ? <>
                    <div className = "section-divider"></div>
                    {this.props.isOwner ? <>
                        {this.props.rebalance && this.props.synopticConverted ? this.renderFeesToClaim() : null}
                        <button className = "button-base button-primary" disabled={!this.props.rebalance} onClick={this.props.onRebalance}>
                            <i className = "fa-solid fa-scale-unbalanced"></i>
                            Rebalance
                        </button>
                    </> : null}
                    <div className="position-synopsis-list" style={{"margin-top" : "5%"}}>
                        {this.props.items.map(this.renderCard)}
                    </div>
                </> : null}
            </div>
        );
    }
});