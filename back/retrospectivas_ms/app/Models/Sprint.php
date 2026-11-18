<?php
declare(strict_types=1);
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
class Sprint extends Model {
    protected $table='sprints';
    protected $fillable=['nombre','fecha_inicio','fecha_fin'];
    protected $hidden=['cierre'];
    public function items(): HasMany { return $this->hasMany(RetroItem::class,'sprint_id'); }
    public function cierre(): HasOne {
        return $this->hasOne(RetroItem::class,'sprint_id')->where('categoria','otro')->where('descripcion',RetroItem::CIERRE)->whereNotNull('fecha_revision');
    }
    public function finalizado(): bool { return $this->relationLoaded('cierre') ? $this->getRelation('cierre')!==null : $this->cierre()->exists(); }
    public function scopeAbiertos($query) { return $query->whereDoesntHave('cierre'); }
    public function scopeFinalizados($query) { return $query->whereHas('cierre'); }
}
