var ConsoleCard = React.createClass({
    render() {
        if(!window.consoleAttached) {
            window.consoleAttached = true;
            var oldConsoleLog = console.log;
            var oldConsoleError = console.error;
            var oldConsoleWarn = console.warn;
            var onConsole = function(oldFunction, level, args) {
                oldFunction.apply(console, args);
                if(!window.consoleEl) {
                    return;
                }
                try {
                    var message = "[" + level + "] ";
                    for(var i = 0; i < args.length; i++) {
                        if(typeof args[i] === "object") {
                            message += args[i] instanceof Error ? args[i].stack : JSON.stringify(args[i]);
                        } else {
                            message += args[i];
                        }
                        message += " ";
                    }
                    var el = document.createElement("div");
                    el.innerHTML = (message.trim() + "\n\n").split(" ").join("&nbsp;").split("\n").join("<br/>");
                    window.consoleEl.appendChild(el);
                } catch(e) {
                    oldConsoleLog.apply(console, ["Error in console log: " + e]);
                    oldConsoleError.apply(console, [e]);
                    window.consoleEl = document.body;
                    onConsole(oldFunction, level, args);
                }
            };
            console.log = function() {
                onConsole(oldConsoleLog, "Info", arguments);
            };
            console.error = function() {
                onConsole(oldConsoleError, "Error", arguments);
            };
            console.warn = function() {
                onConsole(oldConsoleWarn, "Warning", arguments);
            }
        }
        return (
            <div className = "glass-card card-pad" style={{"display" : this.props.show ? "initial" : "none"}}>
                <div className = "card-title">
                    Console
                </div>
                    <div className = "section-divider"></div>
                    <div className="position-synopsis-list" style={{"margin-top" : "5%"}}>
                        <div ref={(el) => {window.consoleEl = el;}} style={{height: "300px", width: "100%", overflowX: "auto", overflowY: "auto"}}></div>
                    </div>
            </div>
        );
    }
});