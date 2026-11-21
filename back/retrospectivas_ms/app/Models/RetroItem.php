<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RetroItem extends Model
{
    public const CIERRE = 'Retrospectiva finalizada.';
    protected $table = 'retro_items';
    protected $fillable = ['sprint_id', 'categoria', 'descripcion', 'cumplida', 'fecha_revision'];
    protected $casts = ['cumplida' => 'boolean'];
    public function sprint(): BelongsTo
    {
        return $this->belongsTo(Sprint::class, 'sprint_id');
    }
    public function scopeVisibles($query)
    {
        return $query->whereRaw("NOT (categoria = ? AND descripcion = ? AND fecha_revision IS NOT NULL)", ['otro', self::CIERRE]);
    }
}
