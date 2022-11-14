import $ from "jquery";
import _ from "lodash";

interface _any {
    [key: string]: any
}

interface KeyValuePair extends _any {
    key: string,
    value: any
}

export default class Component {
    public el: any;
    public $: JQuery;
    public template: any = undefined;

    constructor( el: (string|Element), ...options: any ) {
        var self = this;
        $(function() {
            if ( el == undefined ) {
                throw new Error("The element was not defined.");
            }
            self.el = el;
            self.$ = $(self.el);
            self.state = (typeof self.state == "function")? self.state(): self.state;
            self.collection = (typeof self.collection == "function")? self.collection(): self.collection;
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
    public _observer: MutationObserver = undefined;
    public _initialReady: _any = {};
    public collection: any = undefined;

    public _mutate() {
        let self = this;
        self.$.on("mutate", function( event: any, property: any ) {
            if( self.mutate[property] != undefined ) {
                self.mutate[property].call( self, event );
            }
        });
    }

    public _state( state?: any ) {
        let self = this;
        if ( state ) {
            self.state = state;
            self.$.triggerHandler( "mutate", ["*"] );
        }
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
                self.$.find(target.key).length != 0  ||
                target.key == "self"
            ) {
                target.value.forEach(function( element: any ) {
                    element.call( self, (target.key == "self")? self.$: $(target.key) );
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
        self._observer.observe(self.$[0], { subtree: true, childList: true });
    }

    public _events() {
        var self = this;
        self.entries( self.events ).forEach(function( event: any ) {
            let data = event.key.split(" ");
            if ( data.length == 1) {
                data[1] =  "self";
            } else if ( data.length > 2 ) {
                data[1] = data.slice( 1 ).join(" ");
            }
            self.ready[data[1]] = function() {
                ((data[1] == "self")? self.$: self.$.find(data[1])).on(data[0], event.value.bind( self ));
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

    public renderCollection() {
        let self = this;
        let container$ = (self.collection.el == "self")? self.$: self.$.find( self.collection.el );
        if ( self.collection.elements ) {
            $(container$).empty();
        }
        let collection = self.state[self.collection.source];
        if (Array.isArray( collection )) {
            self.collection.elements = collection.reduce(function( elements: any[], state: any, index: number ) {
                let template = (typeof self.collection.template == "string")? self.collection.template: self.collection.template( state, index );
                let el = $( template ).appendTo( container$ );
                let view: any = undefined;
                if ( self.collection.view ) {
                    view = self.collection.view( el, state, index );
                }
                if ( self.collection.action ) {
                    self.collection.action( el, state, index, view );
                }
                elements.push({
                    el,
                    state,
                    view
                });
                return elements;
            }, []);
            self.$.triggerHandler("renderCollection");
        } else {
            throw new Error("The collection source was not an array.");
        }
    }

    public render() {
        let self = this;
        self.$.off();
        self.$.html(self.template( self.state ));
        self._on();
        self.$.triggerHandler("render");
    }
};