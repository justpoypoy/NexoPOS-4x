<template>
    <div class="bg-white shadow-xl w-4/5-screen md:w-2/5-screen xl:w-108">
        <div id="header" class="border-b border-gray-200 text-center font-semibold text-2xl text-gray-700 py-2">
            <h2>Select Customer</h2>
        </div>
        <div class="p-2 border-b border-gray-200 flex justify-between text-gray-600">
            <span>Selected : </span>
            <span>{{ order.customer ? order.customer.name : 'N/A' }}</span>
        </div>
        <div class="p-2 border-b border-gray-200 flex justify-between text-gray-600">
            <input
                ref="searchField" 
                @keydown.enter="attemptToChoose()"
                v-model="searchCustomerValue"
                placeholder="Search Customer" 
                type="text" 
                class="rounded border-2 border-blue-400 bg-gray-100 w-full p-2">
        </div>
        <div class="h-3/5-screen xl:h-2/5-screen overflow-y-auto">
            <ul>
                <li class="p-2 text-center text-gray-600" v-if="customers && customers.length === 0">
                    No customer match your query...
                </li>
                <li @click="selectCustomer( customer )" v-for="customer of customers" :key="customer.id" class="cursor-pointer hover:bg-gray-100 p-2 border-b border-gray-200 text-gray-600 flex justify-between items-center">
                    <span>{{ customer.name }}</span>
                    <p class="flex items-center">
                        <span v-if="customer.owe_amount > 0" class="text-red-600">-{{ customer.owe_amount | currency }}</span>
                        <span v-if="customer.owe_amount > 0">/</span>
                        <span class="text-green-600">{{ customer.purchases_amount | currency }}</span>
                        <button @click="openCustomerHistory( customer, $event )" class="mx-2 rounded-full h-8 w-8 flex items-center justify-center border border-gray-200 hover:bg-blue-400 hover:text-white hover:border-transparent">
                            <i class="las la-eye"></i>
                        </button>
                    </p>
                </li>
            </ul>
        </div>
    </div>
</template>
<script>
import { nsHttpClient, nsSnackBar } from '@/bootstrap';
import resolveIfQueued from "@/libraries/popup-resolver";
import { Popup } from '@/libraries/popup';
import nsPosCustomersVue from './ns-pos-customers.vue';

export default {
    data() {
        return {
            searchCustomerValue: '',
            orderSubscription: null,
            order: {},
            debounceSearch: null,
            customers: []
        }
    },
    computed: {
        customerSelected() {
            return false;
        }
    },
    watch: {
        searchCustomerValue( value ) {
            clearTimeout( this.debounceSearch );
            this.debounceSearch     =   setTimeout( () => {
                this.searchCustomer( value );
            }, 500 );
        }
    },
    mounted() {
        this.$popup.event.subscribe( action => {
            if ( action.event === 'click-overlay' ) {
                this.resolveIfQueued( false );
            }
        });

        this.orderSubscription  =   POS.order.subscribe( order => {
            this.order      =   order;
        });

        this.getRecentCustomers();

        this.$refs.searchField.focus();
    },
    destroyed() {
        this.orderSubscription.unsubscribe();
    },
    methods: {
        /**
         * if the popup is likely to be used
         * on a queue, using the resolveIfQueued
         * could help being notified when it's closed.
         */
        resolveIfQueued,

        attemptToChoose() {
            if ( this.customers.length === 1 ) {
                return this.selectCustomer( this.customers[0] );
            }
            nsSnackBar.info( 'Too many result.' ).subscribe();
        },

        openCustomerHistory( customer, event ) {
            event.stopImmediatePropagation();
            this.$popup.close();
            Popup.show( nsPosCustomersVue, { customer, activeTab: 'customer-account' });
        },

        selectCustomer( customer ) {
            this.customers.forEach( customer => customer.selected = false );
            customer.selected   =   true;

            /**
             * define the customer using the default
             * POS object;
             */
            POS.selectCustomer( customer );
            this.resolveIfQueued( customer );
        },
        searchCustomer( value ) {
            nsHttpClient.post( '/api/nexopos/v4/customers/search', {
                search: value
            }).subscribe( customers => {
                customers.forEach( customer => customer.selected = false );
                this.customers  =   customers;
            })
        },
        getRecentCustomers() {
            nsHttpClient.get( '/api/nexopos/v4/customers' )
                .subscribe( customers => {
                    customers.forEach( customer => customer.selected = false );
                    this.customers  =   customers;
                })
        }
    }
}
</script>