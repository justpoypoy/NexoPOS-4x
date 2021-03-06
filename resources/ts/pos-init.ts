import { ProductQuantityPromise } from "./pages/dashboard/pos/queues/products/product-quantity";
import { ProductUnitPromise } from "./pages/dashboard/pos/queues/products/product-unit";
import { Subject, BehaviorSubject, forkJoin } from "rxjs";
import { Product } from "./interfaces/product";
import { Customer } from "./interfaces/customer";
import { OrderType } from "./interfaces/order-type";
import { POSVirtualStock } from "./interfaces/pos-virual-stock";
import Vue from 'vue';
import { Order } from "./interfaces/order";
import { nsEvent, nsHttpClient, nsSnackBar } from "./bootstrap";
import { PaymentType } from "./interfaces/payment-type";
import { Payment } from "./interfaces/payment";
import { timeStamp } from "console";
import { Responsive } from "./libraries/responsive";
import { Popup } from "./libraries/popup";
import { OrderProduct } from "./interfaces/order-product";

/**
 * these are dynamic component
 * that are loaded conditionally
 */
const NsPosDashboardButton      =   (<any>window).NsPosDashboardButton         =   require( './pages/dashboard/pos/header-buttons/ns-pos-dashboard-button' ).default;
const NsPosPendingOrderButton   =   (<any>window).NsPosPendingOrderButton      =   require( './pages/dashboard/pos/header-buttons/ns-pos-' + 'pending-orders' + '-button' ).default;
const NsPosOrderTypeButton      =   (<any>window).NsPosOrderTypeButton         =   require( './pages/dashboard/pos/header-buttons/ns-pos-' + 'order-type' + '-button' ).default;
const NsPosCustomersButton      =   (<any>window).NsPosCustomersButton         =   require( './pages/dashboard/pos/header-buttons/ns-pos-' + 'customers' + '-button' ).default;
const NsAlertPopup              =   (<any>window).NsAlertPopup                 =   require( './popups/ns-' + 'alert' + '-popup' ).default;
const NsConfirmPopup            =   (<any>window).NsConfirmPopup               =   require( './popups/ns-pos-' + 'confirm' + '-popup' ).default;
const NsPromptPopup             =   (<any>window).NsPromptPopup               =   require( './popups/ns-' + 'prompt' + '-popup' ).default;
const NsLayawayPopup            =   (<any>window).NsLayawayPopup               =   require( './popups/ns-pos-' + 'layaway' + '-popup' ).default;

export class POS {
    private _products: BehaviorSubject<OrderProduct[]>;
    private _breadcrumbs: BehaviorSubject<any[]>;
    private _customers: BehaviorSubject<Customer[]>;
    private _settings: BehaviorSubject<{ [ key: string] : any}>;
    private _types: BehaviorSubject<OrderType[]>;
    private _paymentsType: BehaviorSubject<PaymentType[]>;
    private _order: BehaviorSubject<Order>;
    private _screen: BehaviorSubject<string>;
    private _options: BehaviorSubject<{ [key:string] : any}>;
    private _responsive         =   new Responsive;
    private _visibleSection: BehaviorSubject<'cart' | 'grid' | 'both'>;
    private _isSubmitting       =   false;
    private defaultOrder        =   (): Order => ({
        discount_type: null,
        title: '',
        discount: 0,
        discount_percentage: 0,
        subtotal: 0,
        total: 0,
        tendered: 0,
        payment_status: undefined,
        customer_id: undefined,
        change: 0,
        total_products: 0,
        shipping: 0,
        tax_value: 0,
        shipping_rate: 0,
        shipping_type: undefined,
        customer: undefined,
        type: undefined,
        products: [],
        payments: [],
        addresses: {
            shipping: undefined,
            billing: undefined
        }
    })

    constructor() {
        this.initialize();
    }

    get screen() {
        return this._screen;
    }

    get visibleSection() {
        return this._visibleSection;
    }

    get paymentsType() {
        return this._paymentsType;
    }

    get order() {
        return this._order;
    }

    get types() {
        return this._types;
    }

    get products() {
        return this._products;
    }

    get customers() {
        return this._customers;
    }

    get options() {
        return this._options;
    }

    get settings() {
        return this._settings;
    }

    get breadcrumbs() {
        return this._breadcrumbs;
    }

    reset() {
        this._isSubmitting  =   false;
        this._products.next([]);
        this._customers.next([]);
        this._breadcrumbs.next([]);
        this.defineCurrentScreen();

        /**
         * to reset order details
         */
        this.order.next( this.defaultOrder() );
    }

    public initialize()
    {
        this._products          =   new BehaviorSubject<OrderProduct[]>([]);
        this._customers         =   new BehaviorSubject<Customer[]>([]);
        this._types             =   new BehaviorSubject<OrderType[]>([]);
        this._breadcrumbs       =   new BehaviorSubject<any[]>([]);
        this._screen            =   new BehaviorSubject<string>('');
        this._paymentsType      =   new BehaviorSubject<PaymentType[]>([]);   
        this._visibleSection    =   new BehaviorSubject( 'both' );     
        this._options           =   new BehaviorSubject({});
        this._order             =   new BehaviorSubject<Order>( this.defaultOrder() );
        this._settings          =   new BehaviorSubject<{ [ key: string ] : any }>({});
        
        /**
         * Whenever there is a change
         * on the products, we'll update
         * the cart.
         */
        this.products.subscribe( _ => {
            this.refreshCart();
        });

        /**
         * listen to type for updating
         * the order accordingly
         */
        this.types.subscribe( types => {
            const selected  =   types.filter( type => type.selected );

            if ( selected.length > 0  ) {
                const order     =   this.order.getValue();
                order.type      =   selected[0];
                this.order.next( order );
            }
        });

        /**
         * We're handling here the responsive aspect
         * of the POS.
         */
        window.addEventListener( 'resize', () => {
            this._responsive.detect();
            this.defineCurrentScreen();
        });

        this.defineCurrentScreen();
    }
    
    public header   =   {
        /**
         * As POS object is defined on the
         * header, we can use that to reference the buttons (component)
         * that needs to be rendered dynamically
         */
        buttons: {
            NsPosDashboardButton,
            NsPosPendingOrderButton,
            NsPosOrderTypeButton,
            NsPosCustomersButton,
        }
    }

    defineOptions( options ) {
        this._options.next( options );
    }

    defineCurrentScreen() {
        this._visibleSection.next([ 'xs', 'sm' ].includes( <string>this._responsive.is() ) ? 'grid' : 'both' );
        this._screen.next( <string>this._responsive.is() );
    }

    changeVisibleSection( section ) {
        if ([ 'both', 'cart', 'grid' ].includes( section ) ) {
            this._visibleSection.next( section );
        }
    }

    addPayment( payment: Payment ) {
        if ( payment.value > 0 ) {
            const order  =   this._order.getValue();
            order.payments.push( payment );
            this._order.next( order );
            
            return this.computePaid();
        }

        return nsSnackBar.error( 'Invalid amount.' ).subscribe();
    }

    removePayment( payment: Payment ) {

        if ( payment.id !== undefined ) {
            return nsSnackBar.error( 'Unable to delete a payment attached to the order' ).subscribe();
        }

        const order     =   this._order.getValue();
        const index     =   order.payments.indexOf( payment );
        order.payments.splice( index, 1 );
        this._order.next( order );

        nsEvent.emit({ 
            identifier: 'ns.pos.remove-payment',
            value: payment
        });

        this.updateCustomerAccount( payment );
        this.computePaid();
    }

    updateCustomerAccount( payment: Payment ) {
        if ( payment.identifier === 'account-payment' ) {
            const customer              =   this.order.getValue().customer;
            customer.account_amount     +=  payment.value;
            this.selectCustomer( customer );
        }
    }

    /**
     * This will check if the order can be saved as layway.
     * might request additionnal information through a popup.
     * @param order Order
     */
    canProceedAsLaidAway( order: Order ) {
        return new Promise( async ( resolve, reject ) => {
            const minimalPaymentPercent     =   order.customer.group.minimal_credit_payment;
            const expected                  =   ( order.total * minimalPaymentPercent ) / 100;

            /**
             * checking order details
             * installments & payment date
             */
            if ( order.expected_payment_date === undefined ) {
                try {
                    await new Promise( ( resolve, reject ) => {
                        Popup.show( NsLayawayPopup, { order, reject, resolve });
                    });
                } catch( exception ) {
                    return reject( exception );
                }
            }

            if ( order.tendered < expected ) {
                const message   =    `Before saving the order as laid away, a minimum payment of ${ Vue.filter( 'currency' )( expected ) } is required`;
                Popup.show( NsAlertPopup, { title: 'Unable to proceed', message });
                return reject({ status: 'failed', message });
            }

            return resolve({ status: 'success', message: 'Can Proceed as layaway' });
        });
    }

    submitOrder() {
        return new Promise( async ( resolve, reject ) => {
            const order             =   <Order>this.order.getValue();
            const minimalPayment    =   order.customer.group.minimal_credit_payment;

            /**
             * this verification applies only if the 
             * order is not "hold".
             */
            if ( order.payment_status !== 'hold' ) {
                if ( order.payments.length  === 0 ) {
                    if ( this.options.getValue().ns_orders_allow_unpaid === 'no' ) {
                        const message   =   'Please provide a payment before proceeding.';
                        return reject({ status: 'failed', message  });
                    } else if ( minimalPayment > 0 ) {
                        try {
                            await this.canProceedAsLaidAway( order );
                        } catch( exception ) {
                            return reject( exception );
                        }
                    }
                }
    
                if ( order.total > order.tendered ) {
                    if ( this.options.getValue().ns_orders_allow_partial === 'no' ) {
                        const message   =   'Partially paid orders are disabled.';
                        return reject({ status: 'failed', message });
                    } else if ( minimalPayment > 0 ) {
                        try {
                            await this.canProceedAsLaidAway( order );
                        } catch( exception ) {
                            return reject( exception );
                        }
                    }
                }
            }

            if ( ! this._isSubmitting ) {
                
                const order     =   this.order.getValue();
                const method    =   order.id !== undefined ? 'put' : 'post';

                return nsHttpClient[ method ]( `/api/nexopos/v4/orders${ order.id !== undefined ? '/' + order.id : '' }`, order )
                    .subscribe( result => {
                        this._isSubmitting  =   true;
                        resolve( result );
                        this.reset();
                    }, error => {
                        this._isSubmitting  =   false;
                        reject( error );
                    })
            }

            return reject({ status: 'failed', message: 'An order is currently being processed.' });
        });
    }

    loadOrder( order_id ) {
        nsHttpClient.get( `/api/nexopos/v4/orders/${order_id}/pos` )
            .subscribe( ( order: any ) => {
                /**
                 * We'll rebuilt the product
                 */
                const products  =   order.products.map( (orderProduct: OrderProduct ) => {
                    orderProduct.$original       =   () => orderProduct.product;
                    orderProduct.$quantities     =   () => orderProduct
                        .product
                        .unit_quantities
                        .filter( unitQuantity => unitQuantity.id === orderProduct.unit_quantity_id )[0];
                    return orderProduct;
                });

                /**
                 * we'll redefine the order type
                 */
                order.type          =   this.types.getValue().filter( type => type.identifier === order.type )[0];

                /**
                 * the address is provided differently
                 * then we need to rebuild it the way it's saved and used
                 */
                order.addresses     =   {
                    shipping    :   order.shipping_address,
                    billing     :   order.billing_address
                }

                delete order.shipping_address;
                delete order.billing_address;

                
                /**
                 * let's all set, let's load the order
                 * from now. No further change is required
                 */
                
                this.buildOrder( order );
                this.buildProducts( products );
                this.selectCustomer( order.customer );
                // this.refreshProducts( this.products.getValue() );
                // this.refreshCart();
            });
    }

    buildOrder( order ) {
        this.order .next( order );
    }

    buildProducts( products ) {
        this.products.next( products );
    }

    printOrder( order_id ) {
        const printSection      =   document.createElement( 'iframe' );
        printSection.id         =   'printing-section';
        printSection.className  =   'hidden';
        printSection.src        =   this.settings.getValue()[ 'urls' ][ 'printing_url' ].replace( '{id}', order_id );

        document.body.appendChild( printSection );
    }

    computePaid() {
        const order     =   this._order.getValue();   
        order.tendered      =   0;

        if ( order.payments.length > 0 ) {
            order.tendered      =   order.payments.map( p => p.value ).reduce( ( b, a ) => a + b );
        }

        if ( order.tendered >= order.total ) {
            order.payment_status    =   'paid';
        } else if ( order.tendered > 0 && order.tendered < order.total ) {
            order.payment_status    =   'partially_paid';
        } 
        
        order.change    =   order.tendered - order.total;

        this._order.next( order );
    }

    setPaymentActive( payment ) {
        const payments  =   this._paymentsType.getValue();
        const index     =   payments.indexOf( payment );
        payments.forEach( p => p.selected = false );
        payments[ index ].selected  =   true;
        this._paymentsType.next( payments );
    }

    definedPaymentsType( payments ) {
        this._paymentsType.next( payments );
    }

    selectCustomer( customer ) {
        const order         =   this.order.getValue();
        order.customer      =   customer;
        order.customer_id   =   customer.id
        this.order.next( order );

        /**
         * asynchronously we can load
         * customer meta data
         */
        nsHttpClient.get( `/api/nexopos/v4/customers/${customer.id}/group` )
            .subscribe( group => {
                order.customer.group      =   group;
                this.order.next( order );
            });
    }

    updateCart( current, update ) {
        for( let key in update ) {
            if ( update[ key ] !== undefined ) {
                Vue.set( current, key, update[ key ]);
            }
        }

        this.order.next( current );
        
        /**
         * explicitely here we do manually refresh the cart
         * as if we listen to cart update by subscribing,
         * that will create a loop (huge performance issue).
         */
        this.refreshCart();
    }

    refreshCart() {
        const products      =   this.products.getValue();
        const order         =   this.order.getValue();
        const productTotal  =   products
            .map( product => product.total_price );
        
        if ( productTotal.length > 0 ) {
            order.subtotal  =   productTotal.reduce( ( b, a ) => b + a );
        } else {
            order.subtotal  =   0;
        }

        if ( order.discount_type === 'percentage' ) {
            order.discount   =   ( order.discount_percentage * order.subtotal ) / 100;
        }

        /**
         * if the discount amount is greather
         * than the subtotal, the discount amount
         * will be set to the order.subtotal
         */
        if ( order.discount > order.subtotal ) {
            order.discount = order.subtotal;
            nsSnackBar.info( 'The discount has been set to the cart subtotal' )
                .subscribe();
        }

        const totalTaxes        =   products.map( ( product: OrderProduct ) => product.tax_value );

        /**
         * tax might be computed above the tax that currently
         * applie to the items.
         */
        order.tax_value         =   0;

        if ( totalTaxes.length > 0 ) {
            order.tax_value     =   totalTaxes.reduce( ( b, a ) => b + a );
        }

        order.total             =   ( order.subtotal + order.shipping ) - order.discount;
        order.products          =   products;
        order.total_products    =   products.length

        this.order.next( order );
    }

    /**
     * Get actual stock used by the product
     * using the defined unit
     * @param product_id 
     * @param unit_id 
     */
    getStockUsage( product_id: number, unit_quantity_id: number ) {
        const stocks    =   this._products.getValue().filter( (product: OrderProduct ) => {
            return product.product_id === product_id && product.unit_quantity_id === unit_quantity_id;
        }).map( product => product.quantity );

        if ( stocks.length > 0 ) {
            return stocks.reduce( ( b, a ) => b + a );
        }

        return 0;
    }

    /**
     * this is resolved when a product is being added to the
     * cart. That will help to mutate the product before 
     * it's added the cart.
     */
    private addToCartQueue  =   [
        ProductUnitPromise,
        ProductQuantityPromise
    ];

    /**
     * Process the item to add it to the cart
     * @param product 
     */
    async addToCart( product ) {

        /**
         * This is where all the mutation made by the  
         * queue promises are stored.
         */
        let productData   =   new Object;

        /**
         * Let's combien the built product
         * with the data resolved by the promises
         */
        let cartProduct: OrderProduct   =  {
            product_id          : product.id,
            name                : product.name,
            discount_type       : 'percentage',
            discount            : 0,
            discount_percentage : 0,
            quantity            : 0,
            tax_group_id        : product.tax_group_id,
            tax_value           : 0, // is computed automatically using $original()
            unit_price          : 0,
            total_price         : 0,
            mode                : 'normal',
            $original           : () => product
        };

        for( let index in this.addToCartQueue ) {

            /**
             * the popup promise receives the product that
             * is above to be added. Hopefully as it's passed by reference
             * updating the product should mutate that once the queue is handled.
             */
            try {
                const promiseInstance   =   new this.addToCartQueue[ index ]( cartProduct );
                const result            =   <Object>(await promiseInstance.run( productData ));

                /**
                 * We just mix both to make sure
                 * the mutated value overwrite previously defined values.
                 */
                productData             =   { ...productData, ...result };

            } catch( brokenPromise ) {
                /**
                 * if a popup resolve "false",
                 * that means for some reason the Promise has
                 * been broken, therefore we need to stop the queue.
                 */
                if ( brokenPromise === false ) {
                    return false;
                }
            }
        }

        /**
         * Let's combien the built product
         * with the data resolved by the promises
         */
        cartProduct   =   { ...cartProduct, ...productData };
        
        /**
         * retreive product that 
         * are currently stored
         */
        const products      =   this._products.getValue();
        
        /**
         * push the new product
         * at the front of the cart
         */
        products.unshift( cartProduct );

        /**
         * Once the product has been added to the cart
         * it's being computed
         */
        this.refreshProducts( products );

        /**
         * dispatch event that the 
         * product has been added.
         */
        this._products.next( products );
    }

    defineTypes( types ) {
        this._types.next( types );
    }

    removeProduct( product ) {
        const products  =   this._products.getValue();
        const index     =   products.indexOf( product );
        products.splice( index, 1 );
        this._products.next( products );
    }

    updateProduct( product, data ) {
        const products                      =   this._products.getValue();
        const index                         =   products.indexOf( product );

        /**
         * to ensure Vue updates accordingly.
         */
        Vue.set( products, index, { ...product, ...data });

        this.refreshProducts( products );
        this._products.next( products );
    }

    refreshProducts( products ) {
        products.forEach( product => {
            this.computeProduct( product );
        });
    }

    computeProduct( product: OrderProduct ) {
        /**
         * determining what is the 
         * real sale price
         */
        if ( product.mode === 'normal' ) {
            product.unit_price          =       product.$quantities().sale_price;
            product.tax_value           =       product.$quantities().sale_price_tax * product.quantity;
        } else {
            product.unit_price          =       product.$quantities().wholesale_price;
            product.tax_value           =       product.$quantities().wholesale_price_tax * product.quantity;
        }

        /**
         * computing the discount when it's 
         * based on a percentage
         */
        if ([ 'flat', 'percentage' ].includes( product.discount_type ) ) {
            if ( product.discount_type === 'percentage' ) {
                product.discount  =   ( ( product.unit_price * product.discount_percentage ) / 100 ) * product.quantity;
            }
        }

        product.total_price         =   ( product.unit_price * product.quantity ) - product.discount;
    }

    loadCustomer( id ) {
        return nsHttpClient.get( `/api/nexopos/v4/customers/${id}` );
    }

    defineSettings( settings ) {
        this._settings.next( settings );
    }

    voidOrder( order ) {
        console.log( order.id );
        if ( order.id !== undefined ) {
            if ( [ 'hold' ].includes( order.payment_status ) ) {
                Popup.show( NsConfirmPopup, {
                    title: 'Order Deletion',
                    message: 'The current order will be deleted as no payment has been made so far.',
                    onAction: ( action ) => {
                        if ( action ) {
                            nsHttpClient.delete( `/api/nexopos/v4/orders/${order.id}` )
                                .subscribe( ( result: any ) => {
                                    nsSnackBar.success( result.message ).subscribe();
                                    this.reset();
                                }, ( error ) => {
                                    return nsSnackBar.error( error.message ).subscribe();
                                })
                        }
                    }
                });
            } else {
                Popup.show( NsPromptPopup, {
                    title: 'Void The Order',
                    message: 'The current order will be void. This will cancel the transaction, but the order won\'t be deleted. Further details about the operation will be tracked on the report. Consider providing the reason of this operation.',
                    onAction: ( reason ) => {
                        if ( reason !== false ) {
                            nsHttpClient.post( `/api/nexopos/v4/orders/${order.id}/void`, { reason })
                                .subscribe( ( result: any ) => {
                                    nsSnackBar.success( result.message ).subscribe();
                                    this.reset();
                                }, ( error ) => {
                                    return nsSnackBar.error( error.message ).subscribe();
                                })
                        }
                    }
                });
            }            
        } else {
            nsSnackBar.error( 'Unable to void an unpaid order.' ).subscribe();
        }
    }

    destroy() {
        this._products.unsubscribe();
        this._customers.unsubscribe();
        this._types.unsubscribe();
        this._breadcrumbs.unsubscribe();
        this._paymentsType.unsubscribe();
        this._screen.unsubscribe();
        this._order.unsubscribe();
        this._settings.unsubscribe();
    }
}

(<any>window).POS       =   new POS;
