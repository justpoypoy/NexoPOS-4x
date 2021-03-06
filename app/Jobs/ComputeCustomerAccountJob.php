<?php

namespace App\Jobs;

use App\Events\OrderAfterCreatedEvent;
use App\Events\OrderBeforeDeleteEvent;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ComputeCustomerAccountJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $event;

    /**
     * Create a new job instance.
     *
     * @return void
     */
    public function __construct( $event )
    {
        $this->event   =   $event;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        if ( $this->event instanceof OrderAfterCreatedEvent ) {
            $this->handleIncrease( $this->event );
        } else if ( $this->event instanceof OrderBeforeDeleteEvent ) {
            $this->handleDeletion( $this->event );
        }
    }

    private function handleIncrease( OrderAfterCreatedEvent $event )
    {  
        if ( $event->order->payment_status === 'paid' ) {
            $event->order->customer->purchases_amount    +=  $event->order->total;
        } else if ( $event->order->payment_status === 'partially_paid' ) {
            $event->order->customer->purchases_amount    +=  $event->order->tendered;
        } else {
            $event->order->customer->owed_amount     +=  $event->order->total;
        }
        
        $event->order->customer->save();
    }

    private function handleDeletion( OrderBeforeDeleteEvent $event )
    {
        switch( $event->order->payment_status ) {
            case 'paid': 
                $event->customer->purchases_amount      -=  $event->order->total;
            break;
            case 'partially_paid': 
                $event->customer->purchases_amount      -=  $event->order->tendered;
            break;
            default:
                $event->order->customer->owed_amount    -=  $event->order->total;
            break;
        }
        
        $event->order->customer->save();
    }
}
