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
        return this.formatDate({ days : Math.floor(eoyDate.days) }, "day") || (eoyDate.days > 0 ? "<1 day" : "NOW");
    },
    renderKpi: function(label, value, symbol, extra, className) {
        return <div className = {"kpi-card" + (className ? " " + className : "")}>
            <div className = "kpi-label">{label}</div>
            <div className = "kpi-value">{value}{symbol ? <small> {symbol}</small> : null}</div>
            {extra || null}
        </div>;
    },
    renderAttention: function() {
        var positions = this.props.positions;
        var unbalanced = (positions || []).filter(function(item) { return Math.abs(item.statusResult) === 2; });
        return <section className = "glass-card card-pad attention-card" aria-label = "Positions">
            <div className = "attention-head">
                <h2 className = "card-title">{unbalanced.length ? "Needs attention" : "Positions"}</h2>
                <button type = "button" className = "shell-link" onClick = {this.props.onShowPositions}>All positions<i className = "fa-solid fa-arrow-right" aria-hidden = "true"></i></button>
            </div>
            {!positions ? <div className = "card-copy">Loading status of the positions{String.fromCharCode(0x2026)}</div> :
             !unbalanced.length ? <div className = "attention-ok"><i className = "fa-solid fa-circle-check" aria-hidden = "true"></i>{positions.length === 0 ? "No positions to show." : "All " + positions.length + " positions are collecting or in profit."}</div> :
             <div className = "attention-list">
                {unbalanced.map(function(item, index) {
                    var key = item.poolAddress || index;
                    return <button key = {key} type = "button" className = "attention-row" onClick = {function() { this.props.onOpenPool(key); }.bind(this)}>
                        <span className = "attention-pair">{item.symbol0} / {item.symbol1} <span className = "attention-index">#{item.index}</span></span>
                        <span className = "status-pill status-pill-red">Unbalanced</span>
                        <i className = "fa-solid fa-chevron-right" aria-hidden = "true"></i>
                    </button>;
                }.bind(this))}
                <div className = "card-copy">{positions.length - unbalanced.length} of {positions.length} positions are collecting or in profit.</div>
            </div>}
        </section>;
    },
    renderRateInput: function(name, label, value) {
        var setRate = this.props.setForecastRate;
        return <label className = "runrate-rate">
            <span>{label}</span>
            <input type = "number" min = "0" max = "100" step = "0.1" defaultValue = {value} aria-label = {label + " (%)"} onBlur = {e => String(e.target.value) !== String(value) && setRate(name, e.target.value)}/>
            <small>%</small>
        </label>;
    },
    renderBreakdown: function(forecast, symbol) {
        var rows = [
            { label : "Heritage", key : "heritage", note : "Projected year-end value, starting from today's Heritage" },
            { label : "Claimed fees", key : "claimedFees", currentOnly : true, runningKey : "claimed", note : forecast.claimedFees === null ? "Historical fees are being measured" : "Collected since the start of this year's monitoring" },
            { label : "Rewards", key : "gross", note : forecast.projectedDailyRewards + " " + symbol + "/day after market adjustment, " + forecast.grossNote + forecast.accruedNote }
        ];
        if(forecast.isOwner) rows.push({ label : "Keeper fees", key : "fees", note : forecast.feeDaily + " " + symbol + "/day, " + forecast.feeNote });
        if(forecast.applyNet) rows.push(
            { label : "Taxes", key : "tax", note : forecast.taxRate + "% of claimed fees and rewards before costs, keeper fees not deductible" },
            { label : "Stamp duty", key : "stamp", note : forecast.stampDutyRate + "% a year on the capital value" }
        );
        if(forecast.isOwner) rows.push({ label : "Cloud", key : "cloud", note : "60 EUR a year, after taxes" });
        rows.push(
            { label : "Net spendable", key : "currentYearSpendable", currentOnly : true, note : forecast.periods[0].days + " days; capital not withdrawn" },
            { label : "Still invested now", key : "stillInvestedNow", currentOnly : true, note : "contract value (capital result " + forecast.capitalResult + " " + symbol + ")" },
            { label : "Cumulative spendable", key : "cumulativeSpendable", note : "Opening capital balance " + forecast.openingCapital + " " + symbol + ". Later years carry only a negative balance." }
        );
        return <details className = "runrate-breakdown">
            <summary>How the yearly forecasts are built</summary>
            <label className = "runrate-rate">
                <span>Annual Heritage multiplier</span>
                <input type = "number" min = "0" step = "any" defaultValue = {forecast.annualMultiplier} onBlur = {e => {
                    var value = Number(e.target.value);
                    if(!isFinite(value) || value <= 0) {
                        e.target.value = forecast.annualMultiplier;
                    } else if(value !== forecast.annualMultiplier) {
                        this.props.setForecastRate("annualHeritageMultiplier", value);
                    }
                }} onKeyDown = {e => e.key === "Enter" && e.target.blur()}/>
                <small>×</small>
            </label>
            <div className = "runrate-note">1.00 keeps Heritage flat. Future rewards use average projected Heritage and the current market ratio of {forecast.marketRatio}×. The ratio divides current protocol Heritage by recorded invested capital. Already accrued and collected amounts are shown at their recorded values.</div>
            <div className = "runrate-yearly-scroll" tabIndex = "0" role = "region" aria-label = "Run rate yearly forecast">
                <table className = "runrate-table runrate-yearly-table">
                    <thead><tr><th scope = "col"></th>{forecast.periods.map((period, index) => (
                        <th scope = "col" key = {period.year}>{period.year}{index === 0 ? <div className = "runrate-note">To year end</div> : null}</th>
                    ))}</tr></thead>
                    <tbody>{rows.map(row => <tr key = {row.key} className = {row.key === "cumulativeSpendable" ? "is-total" : ""}>
                        <th scope = "row">{row.label}<div className = "runrate-note">{row.note}</div></th>
                        {forecast.periods.map((period, index) => {
                            if(row.currentOnly && index > 0) return <td key = {period.year}></td>;
                            var value = row.currentOnly ? forecast[row.key] : period[row.key];
                            var running = period.running[row.runningKey || row.key];
                            return <td key = {period.year}>
                                {value === null ? "—" : <>{value} <small>{symbol}</small></>}
                                {value !== null && running !== undefined ? <div className = "runrate-note">= {running}</div> : null}
                            </td>;
                        })}
                    </tr>)}</tbody>
                </table>
            </div>
            {forecast.projectionNote ? <div className = "runrate-note">{forecast.projectionNote}</div> : null}
            <div className = "runrate-note">{forecast.readNote}</div>
            {forecast.applyNet ? <div className = "runrate-rates">
                {this.renderRateInput("taxRate", "Tax on rewards", forecast.taxRateRewards)}
                {this.renderRateInput("stampDutyRate", "Stamp duty", forecast.stampDutyRate)}
                <div className = "runrate-note">Assumptions to confirm with a tax adviser. Rates are stored in this browser only.</div>
            </div> : null}
        </details>;
    },
    renderWhatIf: function(whatIf, symbol) {
        var setRate = this.props.setForecastRate;
        var rows = [["Heritage", "heritage"], ["Projected rewards", "gross"], ["Keeper fees", "fees"]];
        if(whatIf.applyNet) rows.push(["Taxes", "tax"], ["Stamp duty", "stamp"]);
        rows.push(["Cloud", "cloud"], ["Net gain", "net"]);
        return <details className = "runrate-breakdown runrate-whatif">
            <summary>What if I invest{String.fromCharCode(0x2026)}</summary>
            <label className = "runrate-rate runrate-whatif-amount">
                <span>Invested amount</span>
                <input type = "number" min = "0" step = "100" defaultValue = {whatIf.amount || ""} placeholder = "0" aria-label = {"Hypothetical invested amount in " + symbol} onBlur = {e => String(e.target.value || 0) !== String(whatIf.amount) && setRate("whatIfAmount", e.target.value || "0")} onKeyDown = {e => e.key === "Enter" && e.target.blur()}/>
                <small>{symbol}</small>
            </label>
            {!whatIf.horizons.length ? <div className = "runrate-note">{whatIf.investmentBasis === null ? "The projection needs a current position with positive Heritage to estimate rewards." : "Enter an amount to see the projected net gain."}</div> : <div className = "runrate-yearly-scroll" tabIndex = "0" role = "region" aria-label = "What-if yearly projection">
                <table className = "runrate-table runrate-yearly-table">
                    <thead><tr><th scope = "col"></th>{whatIf.horizons.map(h => <th scope = "col" key = {h.year}>Year {h.year}</th>)}</tr></thead>
                    <tbody>{rows.map(row => <tr key = {row[1]} className = {row[1] === "net" ? "is-total" : ""}><th scope = "row">{row[0]}</th>{whatIf.horizons.map(h => <td key = {h.year}>{h[row[1]]} <small>{symbol}</small>{h.running[row[1]] ? <div className = "runrate-note">= {h.running[row[1]]}</div> : null}</td>)}</tr>)}
                    <tr><th scope = "row">Net gain on the amount</th>{whatIf.horizons.map(h => <td key = {h.year}>{h.percent}%</td>)}</tr>
                    <tr>
                        <th scope = "row">Capital back in<div className = "runrate-note">estimated time from the initial investment</div></th>
                        {whatIf.backYear === null ? <td colSpan = {whatIf.horizons.length}>Not reached</td> : whatIf.horizons.map(h => (
                            <td key = {h.year}>{h.year === whatIf.backYear ? whatIf.backMonths + " months" : null}</td>
                        ))}
                    </tr>
                    <tr className = "is-total"><th scope = "row">Net spendable<div className = "runrate-note">Year 1 deducts the initial investment. Later years carry only a negative balance.</div></th>{whatIf.horizons.map(h => <td key = {h.year}>{h.spendable} <small>{symbol}</small></td>)}</tr></tbody>
                </table>
            </div>}
            {whatIf.projectionNote ? <div className = "runrate-note">{whatIf.projectionNote}</div> : null}
            {whatIf.investmentBasis !== null ? <div className = "runrate-note">The scenario starts next 1 January and applies the annual Heritage multiplier of {whatIf.annualMultiplier}× over the actual days in each year. Future rewards use the recent reward rate per unit of today's Heritage ({whatIf.investmentBasis} {symbol}), the market ratio of {whatIf.marketRatio}× and the average projected Heritage. {whatIf.recoveryMonths === null ? "" : "Projected rewards before costs recover the initial amount in about " + whatIf.recoveryMonths + " months. "}{whatIf.applyNet ? "Tax is " + whatIf.taxRate + "% of rewards before costs (keeper fees not deductible). " : ""}Keeper fees and cloud are fixed for the year.</div> : null}
        </details>;
    },
    renderRunRate: function(summary, symbol) {
        if (summary.forecast && summary.forecast.marketRatio === null) {
            return <section className = "glass-card card-pad runrate-card" aria-label = "Run rate forecast">
                <h2 className = "card-title">Run rate forecast</h2>
                <div className = "runrate-note">The scenario needs recorded protocol capital to calculate the market adjustment.</div>
            </section>;
        }
        var items = [
            ["Daily", summary.collectDay],
            ["Weekly", summary.collectWeek],
            ["Monthly", summary.collectMonth],
            ["EOY (" + this.formatEoyDate(summary.eoy) + ")", summary.collectYear]
        ];
        return <section className = "glass-card card-pad runrate-card" aria-label = "Run rate forecast">
            <div className = "runrate-head">
                <h2 className = "card-title">Run rate forecast</h2>
                {this.props.isOwner ? <div className = "runrate-options">
                    <label className = "check-chip">
                        <input type = "checkbox" checked = {this.props.net} onChange = {this.props.toggleNet} />
                        <span>Net</span>
                    </label>
                </div> : null}
            </div>
            <div className = "runrate-grid">
                {items.map(function(item) {
                    var negative = String(item[1]).indexOf('-') === 0;
                    return <div key = {item[0]} className = "runrate-item">
                        <div className = "runrate-label">{item[0]}</div>
                        <div className = {"runrate-value" + (negative ? " is-negative" : "")}>{item[1]} <small>{symbol}</small></div>
                    </div>;
                })}
            </div>
            {summary.forecast ? this.renderBreakdown(summary.forecast, symbol) : null}
            {summary.forecast && summary.forecast.whatIf ? this.renderWhatIf(summary.forecast.whatIf, symbol) : null}
        </section>;
    },
    render: function() {
        var token = this.props.token;
        var symbol = token ? token.symbol : "";
        var summary = this.props.summary;
        var claimableValue = this.props.claimableValue;
        var hasClaimable = !!token && !!claimableValue && claimableValue !== '0';
        var loading = String.fromCharCode(0x2026);
        var pnlClass = !summary || summary.pnl === '0' ? "" : summary.pnl?.indexOf('-') === -1 ? "is-positive" : "is-negative";
        return (
            <>
                <div className = "page-head page-head-overview">
                    <div>
                        <h1 className = "page-title">Overview</h1>
                        <div className = "page-copy">Monitor season progress and collect when ready.</div>
                    </div>
                </div>
                <div className = "overview-body">
                <div className = "kpi-grid">
                    <div className = "kpi-card kpi-card-hero">
                        <div className = "kpi-hero-head">
                            <div className = "kpi-label">Claimable fees</div>
                        </div>
                        <div className = "kpi-value">{token && claimableValue ? fromDecimals(claimableValue, token.decimals, true) : token && summary ? "0" : loading}<small> {symbol}</small></div>
                        <button className = "button-base button-primary kpi-action" disabled = {!hasClaimable} onClick = {this.props.onClaimReward}>
                            {token ? "Claim" : "Select a token first"}
                        </button>
                    </div>
                    {this.renderKpi("Fees accruing", summary ? summary.toBeCollected : loading, symbol, summary && summary.pendingPayout ? <div className = "kpi-note" title = "Fees earned by the positions, paid to the farming at the first sync of the next harvest window">incl. {summary.pendingPayout} at the next payout</div> : null, "kpi-fees")}
                    {this.renderKpi("Claimed fees", summary ? summary.alreadyCollected : loading, symbol, null, "kpi-claimed")}
                    {this.renderKpi("Profit and loss", summary ? summary.pnl : loading, symbol, null, "kpi-pnl" + (pnlClass ? " " + pnlClass : ""))}
                </div>
                <div className = "page-grid page-grid-overview">
                    {summary && summary.monitorStart ? this.renderRunRate(summary, symbol) : null}
                    <CapitalCard token = {token} summary = {summary}/>
                </div>
                <div className = "page-grid page-grid-overview page-grid-overview-foot">
                    <HarvestCycle loadPolicy = {this.props.loadHarvestPolicy} symbol = {symbol} toBeCollected = {summary && summary.toBeCollected} pendingPayout = {summary && summary.pendingPayout}/>
                    {this.renderAttention()}
                </div>
                </div>
            </>
        );
    }
});
