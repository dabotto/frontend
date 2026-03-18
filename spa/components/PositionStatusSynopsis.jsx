var PositionStatusSynopsis = React.createClass({
    getInitialState: function() {
        return { filters: { all: true, unbalanced: false, profit: false, collecting: false }, expanded: {} };
    },
    componentDidUpdate: function(previous) {
        if (previous.items === this.props.items) return;
        var filters = this.normalizeFilters(this.state.filters, this.getCounts(this.props.items));
        if (Object.keys(filters).some(function(key) { return filters[key] !== this.state.filters[key]; }.bind(this))) {
            this.setState({ filters: filters });
        }
    },
    getCounts: function(items) {
        items = items || [];
        var counts = { all: items.length, unbalanced: 0, profit: 0, collecting: 0 };
        items.forEach(function(item) {
            var name = this.getStatusFilter(item);
            if (name) counts[name]++;
        }.bind(this));
        return counts;
    },
    normalizeFilters: function(filters, counts) {
        filters = Object.assign({}, filters);
        ["unbalanced", "profit", "collecting"].forEach(function(name) {
            if (counts[name] === 0) filters[name] = false;
        });
        if (!filters.unbalanced && !filters.profit && !filters.collecting) {
            filters.all = true;
        }
        return filters;
    },
    toggleFilter: function(name, checked) {
        this.setState(function(state, props) {
            var filters = Object.assign({}, state.filters);
            filters[name] = checked;
            if (name === "all" && checked) {
                filters.unbalanced = filters.profit = filters.collecting = false;
            } else if (checked) {
                filters.all = false;
            }
            return { filters: this.normalizeFilters(filters, this.getCounts(props.items)) };
        }.bind(this));
    },
    getStatusFilter: function(item) {
        var score = Math.abs(item.statusResult);
        return score === 2 ? "unbalanced" : score === 1 ? "profit" : score === 0 ? "collecting" : null;
    },
    getVisibleItems: function() {
        var filters = this.normalizeFilters(this.state.filters, this.getCounts(this.props.items));
        return (this.props.items || []).filter(function(item) {
            return filters.all || filters[this.getStatusFilter(item)];
        }.bind(this));
    },
    renderFilters: function() {
        var counts = this.getCounts(this.props.items);
        var filters = this.normalizeFilters(this.state.filters, counts);
        return <div className="position-synopsis-filters" role="group" aria-label="Position status filters">
            {[
                { name: "all", label: "All", score: 0 },
                { name: "unbalanced", label: "Unbalanced", score: 2 },
                { name: "profit", label: "Profit", score: 1 },
                { name: "collecting", label: "Collecting", score: 0 }
            ].map(function(filter) {
                var disabled = filter.name !== "all" && counts[filter.name] === 0;
                return <label key={filter.name} className={this.getScoreClass(filter.score) + " position-synopsis-filter" + (disabled ? " position-synopsis-filter-disabled" : "")}>
                    <input type="checkbox" role="switch" checked={filters[filter.name]} disabled={disabled} onChange={function(event) {
                        this.toggleFilter(filter.name, event.target.checked);
                    }.bind(this)}/>
                    <span>{filter.label} ({counts[filter.name]})</span>
                </label>;
            }.bind(this))}
        </div>;
    },
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
            <div key = {stop.key} className = {"position-stop position-stop-" + stop.kind + " position-stop-" + stop.key} style = {{ left: left + "%" }}>
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
            <div className = {"position-current-price" + (left < 25 ? " position-current-price-start" : left > 75 ? " position-current-price-end" : "")} style = {{ left: left + "%" }}>
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
    formatAmount(amount, decimals, spaces) {
        return formatMoney(fromDecimals(amount, this.props.synopticConverted ? this.props.token.decimals : decimals, true), spaces || 4);
    },
    renderAmountHead: function(item) {
        var unit = this.props.synopticConverted ? <span className = "position-amount-unit">in {this.props.token.symbol}</span> : null;
        return <div className = "position-amount-row position-amount-head">
            <div className = "position-amount-label"></div>
            <div className = "position-amount-ticker"><a target="_blank" title={item.symbol0} href={getEtherscanAddress("token/" + item.token0)}>{item.symbol0}</a>{unit}</div>
            <div className = "position-amount-ticker"><a target="_blank" title={item.symbol1} href={getEtherscanAddress("token/" + item.token1)}>{item.symbol1}</a>{unit}</div>
        </div>;
    },
    toggleDetails: function(key) {
        this.setState(function(state) {
            var expanded = Object.assign({}, state.expanded);
            expanded[key] = !expanded[key];
            return { expanded: expanded };
        });
    },
    renderAmountRow: function(label, item, field0, field1, spaces) {
        return <div key = {label} className = "position-amount-row">
            <div className = "position-amount-label" title = {label}>{label}</div>
            <div className = "position-amount-value">{this.formatAmount(item[field0], item.decimals0, spaces)}</div>
            <div className = "position-amount-value">{this.formatAmount(item[field1], item.decimals1, spaces)}</div>
        </div>;
    },
    renderCard: function(item, index) {
        var score = item.statusResult;
        var stops = this.getStops(item);
        var key = item.poolAddress || index;
        var expanded = !!(this.state.expanded && this.state.expanded[key]);
        var detailsId = "position-details-" + key;
        return (
            <div key = {key} className = "position-synopsis-card glass-card card-pad">
                <div className = "position-card-head">
                    <div className = "position-card-meta">
                        <span className = "position-index"># {item.index}</span>
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
                    <div className = {this.getScoreClass(score)}>
                        <span className = "position-score-label">{this.getScoreLabel(score)}</span>
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
                <div className = "position-amounts">
                    {this.renderAmountHead(item)}
                    {this.renderAmountRow("Fees", item, "feeAmount0", "feeAmount1", 6)}
                    {this.renderAmountRow("Available", item, "poolAmount0", "poolAmount1")}
                    {this.renderAmountRow("Total", item, "token0Amount", "token1Amount")}
                    {this.renderAmountRow(Math.abs(score) === 2 ? "Rebalanced" : "Adjusted", item, "after0", "after1")}
                    {this.renderAmountRow("Surplus", item, "surplus0", "surplus1")}
                    <button
                        type = "button"
                        className = "position-details-toggle"
                        aria-expanded = {expanded}
                        aria-controls = {detailsId}
                        onClick = {function() { this.toggleDetails(key); }.bind(this)}
                    >
                        <span>{expanded ? "Hide details" : "Show details"}</span>
                        <i className = {"fa-solid " + (expanded ? "fa-chevron-up" : "fa-chevron-down")}></i>
                    </button>
                    <div id = {detailsId} className = {"position-amounts-secondary" + (expanded ? "" : " position-amounts-collapsed")}>
                        {this.renderAmountRow("Original", item, "savedToken0Amount", "savedToken1Amount")}
                        {this.renderAmountRow("Difference", item, "difference0", "difference1")}
                    </div>
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
        var visibleItems = this.getVisibleItems();
        return (
            <div className = "glass-card card-pad position-synopsis">
                <div className = "card-title position-synopsis-title">
                    <span>Position status</span>
                    {this.props.items && this.props.items.length > 0 ? <label className="position-synopsis-conversion">
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
                        {this.renderFilters()}
                        {visibleItems.map(this.renderCard)}
                        {visibleItems.length === 0 ? <div className="card-copy">No positions match the selected filters</div> : null}
                    </div>
                </> : null}
            </div>
        );
    }
});
