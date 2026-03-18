var PositionStatusSynopsis = React.createClass({
    getInitialState: function() {
        return { filters: { all: true, unbalanced: false, profit: false, collecting: false }, expanded: {}, query: "", sortColumn: "status", sortDirection: "ascending" };
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
        var query = this.state.query.trim().toLowerCase();
        return (this.props.items || []).filter(function(item) {
            return (filters.all || filters[this.getStatusFilter(item)]) && this.matchesQuery(item, query);
        }.bind(this));
    },
    matchesQuery: function(item, query) {
        return !query || [item.token0, item.token1, item.symbol0, item.symbol1, item.poolAddress].some(function(value) {
            return value !== undefined && value !== null && String(value).toLowerCase().indexOf(query) !== -1;
        });
    },
    renderSearch: function() {
        return <div className="search-shell position-synopsis-search">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
                className="text-input"
                type="search"
                placeholder="Search ticker, token or pool address"
                aria-label="Search positions by ticker, token address or pool address"
                autoComplete="off"
                spellCheck="false"
                value={this.state.query}
                onChange={function(event) { this.setState({ query: event.currentTarget.value }); }.bind(this)}
                onKeyDown={function(event) { if (event.key === "Escape") this.setState({ query: "" }); }.bind(this)}
            />
            {this.state.query ? <button type="button" className="position-synopsis-search-clear" aria-label="Clear search" onClick={function() { this.setState({ query: "" }); }.bind(this)}>
                <i className="fa-solid fa-xmark"></i>
            </button> : null}
        </div>;
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
            <div className = {"position-current-price" + (left < 15 ? " position-current-price-start" : left > 85 ? " position-current-price-end" : "")} style = {{ left: left + "%" }}>
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
    renderSurplusTotal: function(item) {
        if (!this.props.synopticConverted || !item.amountsConverted ||
            item.referenceTokenAddress.toLowerCase() !== this.props.referenceTokenAddress.toLowerCase()) return null;
        var total = web3.utils.toBN(item.surplus0).add(web3.utils.toBN(item.surplus1));
        var pending = total.isZero();
        if(pending) {
            var inProfit = web3.utils.toBN(item.poolAmount0).add(web3.utils.toBN(item.poolAmount1)).gte(web3.utils.toBN(item.savedToken0Amount).add(web3.utils.toBN(item.savedToken1Amount)));
            total = web3.utils.toBN(item.feeAmount0).add(web3.utils.toBN(item.feeAmount1)).muln(inProfit ? 9 : 7).divn(10);
        }
        total = total.toString();
        return <div className="position-surplus-total">
            <span className="position-surplus-label" title={pending ? "Estimated share of the fees paid at the next 4-hour harvest window" : "Paid in this harvest window"}><i className="fa-solid fa-coins" aria-hidden="true"></i>{pending ? "Next harvest payout (est.)" : "Total surplus"}</span>
            <span className="position-surplus-amount">
                <strong>{this.formatAmount(total, this.props.token.decimals, 6)}</strong>
                <span className="position-surplus-unit">{this.props.token.symbol}</span>
            </span>
        </div>;
    },
    componentDidMount: function() {
        this.onKeyDown = function(event) {
            if (event.key === "Escape" && this.props.sheetOpen && this.props.onCloseSheet) this.props.onCloseSheet();
        }.bind(this);
        document.addEventListener("keydown", this.onKeyDown);
    },
    componentWillUnmount: function() {
        document.removeEventListener("keydown", this.onKeyDown);
    },
    getKey: function(item, index) {
        return item.poolAddress || index;
    },
    isConverted: function(item) {
        return !!(this.props.synopticConverted && item.amountsConverted && this.props.token &&
            item.referenceTokenAddress && item.referenceTokenAddress.toLowerCase() === this.props.referenceTokenAddress.toLowerCase());
    },
    renderPairAmount: function(item, field0, field1, spaces) {
        if (this.isConverted(item)) {
            var total = web3.utils.toBN(item[field0]).add(web3.utils.toBN(item[field1])).toString();
            return <span className = "pos-amount">{this.formatAmount(total, this.props.token.decimals, spaces)}</span>;
        }
        return <span className = "pos-amount pos-amount-split">
            <span>{this.formatAmount(item[field0], item.decimals0, spaces)} <small>{item.symbol0}</small></span>
            <span>{this.formatAmount(item[field1], item.decimals1, spaces)} <small>{item.symbol1}</small></span>
        </span>;
    },
    getPayoutAmount: function(item) {
        if (!this.isConverted(item)) return null;
        var total = web3.utils.toBN(item.surplus0).add(web3.utils.toBN(item.surplus1));
        if (total.isZero()) {
            var inProfit = web3.utils.toBN(item.poolAmount0).add(web3.utils.toBN(item.poolAmount1)).gte(web3.utils.toBN(item.savedToken0Amount).add(web3.utils.toBN(item.savedToken1Amount)));
            total = web3.utils.toBN(item.feeAmount0).add(web3.utils.toBN(item.feeAmount1)).muln(inProfit ? 9 : 7).divn(10);
        }
        return total;
    },
    getStatusTone: function(score) {
        return score === 0 ? "blue" : Math.abs(score) === 1 ? "green" : "red";
    },
    renderStatusPill: function(item) {
        return <span className = {"status-pill status-pill-" + this.getStatusTone(item.statusResult)}>
            {this.getScoreLabel(item.statusResult)}
        </span>;
    },
    renderMiniRange: function(item) {
        var left = this.getCurrentPricePercent(item);
        var tone = this.getStatusTone(item.statusResult);
        return <span className = "pos-range" aria-hidden = "true">
            <span className = "pos-range-band"></span>
            {left === null ? null : <span className = {"pos-range-marker pos-range-marker-" + tone} style = {{ left: left + "%" }}></span>}
        </span>;
    },
    sortBy: function(column) {
        this.setState(function(state) {
            return {
                sortColumn: column,
                sortDirection: state.sortColumn === column && state.sortDirection === "ascending" ? "descending" : "ascending"
            };
        });
    },
    getAmountSortValue: function(item, field0, field1) {
        if (this.isConverted(item)) {
            return [web3.utils.toBN(item[field0]).add(web3.utils.toBN(item[field1]))];
        }
        if (this.props.synopticConverted) return null;
        return [Number(fromDecimals(item[field0], item.decimals0, true)), Number(fromDecimals(item[field1], item.decimals1, true))];
    },
    getPoolMetricValue: function(item, field) {
        var metrics = item.poolMetrics;
        if (!metrics) return null;
        if (field === "tvl" || this.props.synopticConverted) {
            if (metrics.referenceTokenAddress !== String(this.props.referenceTokenAddress).toLowerCase()) return null;
            return metrics[field === "amount0" ? "reference0" : field === "amount1" ? "reference1" : field];
        }
        return metrics[field];
    },
    getPoolSortValue: function(item, field, decimals) {
        var amount = this.getPoolMetricValue(item, field);
        if (amount == null) return null;
        var value = web3.utils.toBN(amount);
        return decimals === undefined || this.props.synopticConverted ? value : value.mul(web3.utils.toBN(10).pow(web3.utils.toBN(255 - Number(decimals))));
    },
    getSortValue: function(item) {
        switch (this.state.sortColumn) {
            case "index": return Number(item.index);
            case "pair": return item.symbol0 + " / " + item.symbol1;
            case "status":
                var score = Math.abs(item.statusResult);
                return score === 2 ? 0 : score === 1 ? 1 : score === 0 ? 2 : 3;
            case "range": return this.getCurrentPricePercent(item);
            case "fees": return this.getAmountSortValue(item, "feeAmount0", "feeAmount1");
            case "balance": return this.getAmountSortValue(item, "poolAmount0", "poolAmount1");
            case "payout": return this.getPayoutAmount(item);
            case "tvl": return this.getPoolSortValue(item, "tvl");
            case "token0": return this.getPoolSortValue(item, "amount0", item.decimals0);
            case "token1": return this.getPoolSortValue(item, "amount1", item.decimals1);
        }
    },
    compareSortValues: function(a, b) {
        if (Array.isArray(a)) {
            return this.compareSortValues(a[0], b[0]) || (a.length > 1 ? this.compareSortValues(a[1], b[1]) : 0);
        }
        if (typeof a === "string") return a.localeCompare(b, undefined, { sensitivity: "base" });
        if (typeof a === "number") return a - b;
        return a.cmp(b);
    },
    getSortedItems: function(items) {
        var direction = this.state.sortDirection === "ascending" ? 1 : -1;
        return items.map(function(item, position) {
            return { item: item, position: position, value: this.getSortValue(item) };
        }.bind(this)).sort(function(a, b) {
            if (a.value === null || b.value === null) {
                if (a.value !== b.value) return a.value === null ? 1 : -1;
                return a.position - b.position;
            }
            return direction * this.compareSortValues(a.value, b.value) || a.position - b.position;
        }.bind(this))
            .map(function(entry) { return entry.item; });
    },
    renderSortHeader: function(column, label, className, title) {
        var active = this.state.sortColumn === column;
        var ascending = this.state.sortDirection === "ascending";
        return <button type = "button" className = {"pos-cell pos-sort-button " + className}
            title = {title}
            aria-label = {"Sort by " + (column === "index" ? "position number" : label) + (active ? ", currently " + this.state.sortDirection : "")}
            aria-pressed = {active}
            onClick = {function() { this.sortBy(column); }.bind(this)}>
            <span>{label}</span>
            <i className = {"fa-solid " + (active ? ascending ? "fa-sort-up" : "fa-sort-down" : "fa-sort")} aria-hidden = "true"></i>
        </button>;
    },
    renderPoolMetric: function(item, field, decimals, symbol, label, className) {
        var metrics = item.poolMetrics;
        var inReference = field === "tvl" || this.props.synopticConverted;
        if (inReference && this.props.token) {
            decimals = this.props.token.decimals;
            symbol = this.props.token.symbol;
        }
        var value = this.getPoolMetricValue(item, field);
        var pending = metrics === undefined || !!(inReference && metrics && metrics.referenceTokenAddress !== String(this.props.referenceTokenAddress).toLowerCase());
        var title = pending ? "Loading pool data" : value == null ? "Pool data unavailable" : metrics.poolId ? "Pool reserves from DEX Screener" : "On-chain pool balances";
        if (value != null && inReference) title += ", valued in " + symbol;
        var scale = Number(decimals);
        var digits = value == null ? "" : value.padStart(scale + 1, "0");
        var amount = scale ? digits.slice(0, -scale) + "." + digits.slice(-scale) : digits;
        return <span className = {"pos-cell pos-cell-num pos-cell-pool-metric " + className} title = {title}>
            <span className = "pos-cell-label">{label}</span>
            {value == null ? <span className = "muted-2" aria-label = {title}>{pending ? String.fromCharCode(0x2014) : "Unavailable"}</span> : <span className = "pos-amount">
                {formatMoney(amount, inReference ? 0 : 6)} <small>{symbol}</small>
            </span>}
        </span>;
    },
    renderRow: function(item, selectedKey) {
        var key = this.getKey(item, item.index);
        var selected = key === selectedKey;
        var payout = this.getPayoutAmount(item);
        return <button
            key = {key}
            type = "button"
            className = {"pos-row pos-row-" + this.getStatusTone(item.statusResult) + (selected ? " is-selected" : "")}
            aria-pressed = {selected}
            onClick = {function() { this.props.onSelect(key); }.bind(this)}
        >
            <span className = "pos-cell pos-cell-index">#{item.index}</span>
            <span className = "pos-cell pos-cell-pair">
                <span className = "pos-pair-tickers">{item.symbol0} / {item.symbol1}</span>
                {item.poolMetrics && item.poolMetrics.poolId ? <span className = "pos-pool-source" title = {"UniV4Wrapper pool ID " + item.poolMetrics.poolId}>UniV4Wrapper</span> : null}
            </span>
            <span className = "pos-cell pos-cell-status">{this.renderStatusPill(item)}{item.syncAvailable ? <span className = "pos-sync" title = "Sync available"><i className = "fa-solid fa-rotate" aria-hidden = "true"></i></span> : null}</span>
            <span className = "pos-cell pos-cell-range">{this.renderMiniRange(item)}</span>
            <span className = "pos-cell pos-cell-num pos-cell-fees"><span className = "pos-cell-label">Fees</span>{this.renderPairAmount(item, "feeAmount0", "feeAmount1", 6)}</span>
            <span className = "pos-cell pos-cell-num pos-cell-payout"><span className = "pos-cell-label">Next payout</span>{payout === null ? <span className = "muted-2" title = "Enable the conversion to see the payout">{String.fromCharCode(0x2014)}</span> : <span className = "pos-amount">{this.formatAmount(payout.toString(), this.props.token.decimals, 4)}</span>}</span>
            <span className = "pos-cell pos-cell-num pos-cell-balance"><span className = "pos-cell-label">Balance</span>{this.renderPairAmount(item, "poolAmount0", "poolAmount1")}</span>
            {this.renderPoolMetric(item, "tvl", null, null, "Pool TVL", "pos-cell-tvl")}
            {this.renderPoolMetric(item, "amount0", item.decimals0, item.poolMetrics && item.poolMetrics.native0 ? "ETH" : item.symbol0, "Pool token0", "pos-cell-token0")}
            {this.renderPoolMetric(item, "amount1", item.decimals1, item.poolMetrics && item.poolMetrics.native1 ? "ETH" : item.symbol1, "Pool token1", "pos-cell-token1")}
        </button>;
    },
    renderDetail: function(item) {
        var stops = this.getStops(item);
        var unit = this.props.synopticConverted ? " in " + this.props.token.symbol : "";
        var dexScreenerPool = item.poolMetrics && item.poolMetrics.poolId || item.poolAddress;
        return <div className = "pos-detail">
            <div className = "pos-detail-head">
                <div className = "pos-detail-titles">
                    <div className = "pos-detail-eyebrow">
                        Pool #{item.index} · <a href = {"https://dexscreener.com/" + getAppNetwork().dexscreenerNetwork + "/" + item.poolAddress} target = "_blank" rel = "noreferrer">{shortAddress(item.poolAddress)}<i className = "fa-solid fa-arrow-up-right-from-square" aria-hidden = "true"></i></a>
                    </div>
                    <h2 className = "pos-detail-title">
                        <a href = {getEtherscanAddress("token/" + item.token0)} target = "_blank" rel = "noopener noreferrer" title = {"View " + item.symbol0 + " on the token explorer"}>{item.symbol0}</a>
                        <span aria-hidden = "true"> / </span>
                        <a href = {getEtherscanAddress("token/" + item.token1)} target = "_blank" rel = "noopener noreferrer" title = {"View " + item.symbol1 + " on the token explorer"}>{item.symbol1}</a>
                    </h2>
                </div>
                <div className = "pos-detail-status">
                    {this.renderStatusPill(item)}
                    {item.syncAvailable ? <span className = "status-pill status-pill-neutral">Sync available</span> : null}
                </div>
                <button type = "button" className = "pos-detail-close" aria-label = "Close detail" onClick = {this.props.onCloseSheet}><i className = "fa-solid fa-xmark" aria-hidden = "true"></i></button>
            </div>
            {this.renderSurplusTotal(item)}
            <div className = "position-chart-wrap">
                <div className = "position-chart-grid"></div>
                <div className = "position-chart-line"></div>
                {stops.map(function(stop) {
                    return this.renderStop(stop, item);
                }.bind(this))}
                {this.renderCurrentPrice(item)}
            </div>
            <div className = "position-amounts">
                <div className = "position-amount-row position-amount-head">
                    <div className = "position-amount-label">{unit ? <span className = "position-amount-unit">{unit.trim()}</span> : null}</div>
                    <div className = "position-amount-ticker">{item.symbol0}</div>
                    <div className = "position-amount-ticker">{item.symbol1}</div>
                </div>
                {this.renderAmountRow("Fees", item, "feeAmount0", "feeAmount1", 6)}
                {this.renderAmountRow("Position balance", item, "poolAmount0", "poolAmount1")}
                {this.renderAmountRow("Total", item, "token0Amount", "token1Amount")}
                {this.renderAmountRow("Projected balance", item, "after0", "after1")}
                {this.renderAmountRow("Surplus", item, "surplus0", "surplus1")}
                {this.renderAmountRow("Original", item, "savedToken0Amount", "savedToken1Amount")}
                {this.renderAmountRow("Difference", item, "difference0", "difference1")}
            </div>
            <a className = "button-base button-secondary pos-detail-link" href = {"https://dexscreener.com/" + getAppNetwork().dexscreenerNetwork + "/" + dexScreenerPool} target = "_blank" rel = "noreferrer">
                Open on DEX Screener<i className = "fa-solid fa-arrow-up-right-from-square" aria-hidden = "true"></i>
            </a>
        </div>;
    },
    render() {
        var items = this.props.items;
        var total = (items || []).length;
        var visibleItems = this.getSortedItems(this.getVisibleItems());
        var selectedKey = this.props.selectedKey;
        var selected = visibleItems.filter(function(item) { return this.getKey(item, item.index) === selectedKey; }.bind(this))[0];
        var sheetOpen = !!(this.props.sheetOpen && selected);
        selected = selected || visibleItems[0];
        selectedKey = selected ? this.getKey(selected, selected.index) : null;
        return (
            <>
                <div className = "page-head">
                    <div>
                        <h1 className = "page-title">Positions</h1>
                        <div className = "page-copy">{!items ? "Loading status of the positions" + String.fromCharCode(0x2026) : total === 0 ? "No positions to show." : "The bot syncs pools automatically. A manual sync can collect fees, record an imbalance, or rebalance eligible pools."}</div>
                    </div>
                    {total > 0 && this.props.isOwner ? <div className = "page-actions">
                        <button className = "button-base button-primary" disabled = {!this.props.rebalance} onClick = {this.props.onRebalance}>
                            <i className = "fa-solid fa-scale-unbalanced"></i>
                            Sync pools
                        </button>
                    </div> : null}
                </div>
                {total > 0 ? <div className = {"pos-layout" + (sheetOpen ? " is-sheet-open" : "")}>
                    <section className = "glass-card pos-table-card" aria-label = "Positions list">
                        <div className = "pos-toolbar">
                            {this.renderFilters()}
                            <div className = "pos-toolbar-end">
                                {this.renderSearch()}
                                <label className = "check-chip">
                                    <input type = "checkbox" checked = {!!this.props.synopticConverted} onChange = {this.props.toggleSynopticConverted}/>
                                    <span>In {this.props.token.symbol}</span>
                                </label>
                            </div>
                        </div>
                        <div className = "pos-table">
                            <div className = "pos-row pos-row-head" role = "group" aria-label = "Sort positions">
                                {this.renderSortHeader("index", "#", "")}
                                {this.renderSortHeader("pair", "Pair", "")}
                                {this.renderSortHeader("status", "Status", "")}
                                {this.renderSortHeader("range", "Price range", "", "Sort by price position within the range")}
                                {this.renderSortHeader("fees", "Fees", "pos-cell-num", "With conversion off, sort by the first token amount, then the second")}
                                {this.renderSortHeader("payout", "Next payout", "pos-cell-num", "Enable conversion to see payout amounts")}
                                {this.renderSortHeader("balance", "Balance", "pos-cell-num", "With conversion off, sort by the first token amount, then the second")}
                                {this.renderSortHeader("tvl", "Pool TVL", "pos-cell-num", "Total value of the entire pool in the reference token")}
                                {this.renderSortHeader("token0", "Pool token0", "pos-cell-num", "Token0 held by the entire pool")}
                                {this.renderSortHeader("token1", "Pool token1", "pos-cell-num", "Token1 held by the entire pool")}
                            </div>
                            {visibleItems.map(function(item) { return this.renderRow(item, selectedKey); }.bind(this))}
                            {visibleItems.length === 0 ? <div className = "position-synopsis-empty">
                                <i className = "fa-solid fa-magnifying-glass"></i>
                                <span>{this.state.query.trim() ? "No positions match \u201c" + this.state.query.trim() + "\u201d" : "No positions match the selected filters"}</span>
                            </div> : null}
                        </div>
                        <div className = "pos-count" aria-live = "polite">
                            {visibleItems.length === total ? total + (total === 1 ? " position" : " positions") : visibleItems.length + " of " + total + " positions"}
                            {this.state.sortColumn === "status" && this.state.sortDirection === "ascending" ? " (unbalanced first)" : null}
                        </div>
                    </section>
                    {selected ? <>
                        <div className = "pos-sheet-backdrop" onClick = {this.props.onCloseSheet}></div>
                        <aside className = "glass-card pos-detail-card" aria-label = "Selected pool">{this.renderDetail(selected)}</aside>
                    </> : null}
                </div> : null}
            </>
        );
    }
});
