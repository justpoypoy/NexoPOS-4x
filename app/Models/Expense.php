<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Expense extends Model
{
    use HasFactory;
    
    protected $table    =   'nexopos_' . 'expenses';

    protected $casts    =   [
        'recurring'     =>  'boolean',
        'active'        =>  'boolean',
    ];

    public function category()
    {
        return $this->belongsTo( ExpenseCategory::class, 'category_id' );
    }

    public function scopeRecurring( $query )
    {
        return $query->where( 'recurring', true );
    }

    public function scopeActive( $query )
    {
        return $query->where( 'active', true );
    }
}