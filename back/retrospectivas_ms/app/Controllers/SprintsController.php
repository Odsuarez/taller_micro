<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Sprint;
use App\Models\RetroItem;
use App\Support\Validar;
use App\Support\Reloj;
use App\Services\Transaccion;
use App\Services\ResumenService;
use App\Exceptions\ApiException;

final class SprintsController
{
    public function all(): array
    {
        return Sprint::with('cierre')->orderByDesc('fecha_inicio')->orderByDesc('id')->get()->map(fn($s) => array_merge($s->toArray(), ['estado' => $s->finalizado() ? 'finalizado' : ($s->fecha_inicio > Reloj::hoy() ? 'programado' : 'actual')]))->all();
    }
    public function find(int $id): Sprint
    {
        return Sprint::with('cierre')->findOrFail($id);
    }
    public function actual(): array
    {
        $actual = Sprint::abiertos()->where('fecha_inicio', '<=', Reloj::hoy())->orderByDesc('fecha_inicio')->orderByDesc('id')->first();
        $programado = Sprint::abiertos()->where('fecha_inicio', '>', Reloj::hoy())->orderBy('fecha_inicio')->orderBy('id')->first();
        $resumen = new ResumenService();
        return ['actual' => $actual ? $resumen->detalle($actual) : null, 'programado' => $programado ? $resumen->detalle($programado) : null];
    }
    public function anteriores(): array
    {
        $resumen = new ResumenService();
        return Sprint::finalizados()->with('cierre')->orderByDesc('fecha_inicio')->orderByDesc('id')->get()->map(fn($s) => $resumen->detalle($s))->all();
    }
    public function accionesAnteriores(): array
    {
        $ultimo = Sprint::finalizados()->orderByDesc('fecha_inicio')->orderByDesc('id')->first();
        return ['sprint' => $ultimo ? array_merge($ultimo->toArray(), ['estado' => 'finalizado']) : null, 'acciones' => $ultimo ? $ultimo->items()->where('categoria', 'accion')->orderBy('id')->get()->toArray() : []];
    }
    private function fechas(array $data): array
    {
        $nombre = Validar::texto($data['nombre'] ?? null, 'nombre', 100);
        $inicio = Validar::fecha($data['fecha_inicio'] ?? null, 'fecha_inicio');
        $fin = Validar::fecha($data['fecha_fin'] ?? null, 'fecha_fin');
        if ($fin < $inicio) Validar::error('La fecha final debe ser igual o posterior a la inicial.');
        return [$nombre, $inicio, $fin];
    }
    public function create(array $data): array
    {
        [$nombre, $inicio, $fin] = $this->fechas($data);
        if ($inicio < Reloj::hoy()) Validar::error('La fecha de inicio no puede ser anterior a hoy.');
        $objetivos = Validar::textos($data['objetivos'] ?? [], 'objetivos');
        $retomar = Validar::ids($data['retomar'] ?? [], 'retomar');
        return Transaccion::ejecutar(function () use ($nombre, $inicio, $fin, $objetivos, $retomar) {
            if (Sprint::abiertos()->exists()) throw new ApiException(409, 'SPRINT_ABIERTO', 'Finaliza la retrospectiva del sprint abierto antes de agendar otro.');
            if ($retomar) {
                $ultimo = Sprint::finalizados()->orderByDesc('fecha_inicio')->orderByDesc('id')->first();
                $pendientes = $ultimo ? $ultimo->items()->where('categoria', 'accion')->where(fn($q) => $q->where('cumplida', false)->orWhereNull('cumplida'))->get()->keyBy('id') : new \Illuminate\Database\Eloquent\Collection();
                foreach ($retomar as $id) {
                    if (!$pendientes->has($id)) Validar::error('Solo puedes retomar pendientes del último sprint finalizado.');
                    $objetivos[] = $pendientes[$id]->descripcion;
                }
            }
            $objetivos = array_values(array_unique($objetivos));
            if (!$objetivos || count($objetivos) > 100) Validar::error('El nuevo sprint debe tener entre 1 y 100 objetivos.');
            $sprint = Sprint::create(['nombre' => $nombre, 'fecha_inicio' => $inicio, 'fecha_fin' => $fin]);
            foreach ($objetivos as $descripcion) $sprint->items()->create(['categoria' => 'accion', 'descripcion' => $descripcion, 'cumplida' => false]);
            return (new ResumenService())->detalle($sprint);
        });
    }
    public function update(int $id, array $data): array
    {
        return Transaccion::ejecutar(function () use ($id, $data) {
            $sprint = Sprint::lockForUpdate()->findOrFail($id);
            if ($sprint->finalizado()) throw new ApiException(409, 'SPRINT_FINALIZADO', 'No se pueden cambiar los datos de un sprint finalizado.');
            [$nombre, $inicio, $fin] = $this->fechas(array_merge($sprint->only(['nombre', 'fecha_inicio', 'fecha_fin']), $data));
            if ($sprint->fecha_inicio <= Reloj::hoy() && $inicio !== $sprint->fecha_inicio) Validar::error('El sprint ya comenzó; su fecha de inicio se conserva.');
            if ($inicio !== $sprint->fecha_inicio && $inicio < Reloj::hoy()) Validar::error('La fecha de inicio no puede ser anterior a hoy.');
            if ($fin < Reloj::hoy()) Validar::error('La fecha final no puede ser anterior a hoy.');
            $sprint->fill(['nombre' => $nombre, 'fecha_inicio' => $inicio, 'fecha_fin' => $fin])->save();
            return (new ResumenService())->detalle($sprint->fresh());
        });
    }
}
