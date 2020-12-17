import * as _ from "lodash";

interface _any {
    [key: string]: any
}

interface KeyValuePair extends _any {
    key: string,
    value: any
}

class Component {
    el: string;
    $: JQuery;
    template = "";

    constructor( el: string, ...options: any ) {
        var self = this;
        $(document).ready(function() {
            self.el = el;
            self.$ = $(self.el);
            self.component = (typeof self.component == "function")? self.component(): self.component;
            self.state = (typeof self.state == "function")? self.state(): self.state;
            self.ready = (typeof self.ready == "function")? self.ready(): self.ready;
            self._initialReady = self.ready;
            self.events = (typeof self.events == "function")? self.events(): self.events;
            self.mutate = (typeof self.mutate == "function")? self.mutate(): self.mutate;
            self._state();
            self._on();
            self._observe();
            self.initialize( ...options );
            self._do();
        });
    }

    public initialize( ...options: any ){};

    public log( ...Input: any ) {
        let self = this;
        if ( !!self.debug ) {
            console.log( ...Input );
        }
    }
    
    public debug = true;
    public state: _any = {};
    public events: _any = {};
    public ready: _any = {};
    public set: _any = {};
    public mutate: _any = {};
    public component: _any = {};
    public _observer: MutationObserver = undefined;
    public _initialReady: _any = {};

    public _mutate() {
        let self = this;
        self.$.on("mutate", function( event, property ) {
            if( self.mutate[property] != undefined ) {
                self.mutate[property].call( self, event );
            }
        });
    }

    public _state() {
        var self = this;
        self.state = new Proxy( Object.assign({}, self.state), {
            set: function( target, property: any, value ) {
                target[property] = value;
                self.$.triggerHandler( "mutate", [property.toString()] );
                return true;
            }
        });
    }

    public _ready() {
        let self = this;

        self.ready = self.fromEntries(self.entries( self.ready ).map(function( element ) {
            return {
                key: element.key,
                value: Array.isArray( element.value )? element.value: [ element.value ]
            };
        }));

        self.ready = new Proxy(Object.assign( {}, self.ready ), {
            set: function( target, property: any, value ) {
                let functions = Array.isArray(target[property.toString()])? target[property.toString()]: [];
                target[property] = functions.concat( [value] );
                return true;
            }
        });
    }

    public _do() {
        let self = this;
        self.ready = self.fromEntries(self.entries( self.ready ).filter(function( target ) {
            if ( 
                $(self.el).find(target.key).length != 0  ||
                target.key == "self"
            ) {
                target.value.forEach(function( element: any ) {
                    element((target.key == "self")? self.$: $(target.key));
                });
                return false;
            } else {
                return true; 
            }
        }));
        self._ready();
    }

    public _observe() {
        let self = this;
        self._observer = new MutationObserver(self._do.bind(self));
        self._observer.observe(document.querySelector(self.el), { subtree: true, childList: true });
    }

    public _events() {
        var self = this;
        self.entries( self.events ).forEach(function( event ) {
            let data = event.key.split(" ");
            if ( data.length == 1) {
                data[1] =  "self";
            } else if ( data.length > 2 ) {
                data[1] = data.slice( 1 ).join(" ");
            }
            self.ready[data[1]] = function() {
                $((data[1] == "self")? self.el: data[1]).on(data[0], event.value.bind( self ));
            };
        });
        self._do();
    }

    public _on() {
        let self = this;
        self.ready = self._initialReady;
        self._ready();
        self._events();
        self._mutate();
    }

    public entries( Input: _any ) {
        var array: KeyValuePair[] = [];
        Object.keys( Input ).forEach(function( key ) {
            var object: KeyValuePair = {
                key: key,
                value: Input[key]
            };
            array.push( object );
        });
        return array;
    }

    public fromEntries( entries: KeyValuePair[] ) {
        return entries.reduce(function( object: _any, element ) {
            object[element.key] = element.value;
            return object;
        }, {});
    }

    render() {
        let self = this;
        self.$.off();
        self.$.html(_.template( self.template )( self.state ));
        self._on();
        self.$.triggerHandler("render");
    }
};