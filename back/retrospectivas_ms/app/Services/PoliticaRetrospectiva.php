<?php
declare(strict_types=1);
namespace App\Services;
use App\Models\Sprint;
use App\Support\Reloj;
final class PoliticaRetrospectiva {
    public function actual(): ?Sprint { return Sprint::abiertos()->where('fecha_inicio','<=',Reloj::hoy())->orderByDesc('fecha_inicio')->orderByDesc('id')->first(); }
    public function estado(?Sprint $sprint = null): array {
        $sprint ??= $this->actual();
        $hoy=Reloj::hoy();$vencida=$sprint!==null && $sprint->fecha_fin<$hoy;
        return [
            'fecha_actual'=>$hoy,'zona_horaria'=>date_default_timezone_get(),
            'sprint_actual_id'=>$sprint?->id,'fecha_retrospectiva'=>$sprint?->fecha_fin,
            'retrospectiva_vencida'=>$vencida,
            'requiere_confirmacion_anticipada'=>$sprint!==null && $sprint->fecha_fin>$hoy,
            'bloquear_navegacion'=>$vencida,
            'mensaje'=>$vencida ? 'Debes finalizar la retrospectiva pendiente para continuar.' : null,
            'endpoint_retrospectiva'=>$sprint ? '/sprints/'.$sprint->id.'/retrospectiva' : null
        ];
    }
}
