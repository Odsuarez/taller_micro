<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Models\Sprint;
use App\Models\RetroItem;
use App\Services\Transaccion;
use App\Services\PoliticaRetrospectiva;
use App\Services\ResumenService;
use App\Support\Validar;
use App\Support\Reloj;
use App\Exceptions\ApiException;

final class RetrospectivasController
{
    public function detalle(int $id): array
    {
        $sprint = Sprint::with('cierre')->findOrFail($id);
        $datos = (new ResumenService())->detalle($sprint);
        $datos['control'] = $sprint->finalizado()
            ? ['finalizada' => true, 'requiere_confirmacion_anticipada' => false]
            : array_merge((new PoliticaRetrospectiva())->estado($sprint), ['finalizada' => false]);
        return $datos;
    }
    public function finalizar(int $id, array $data): array
    {
        $realizadas = Validar::ids($data['realizadas'] ?? [], 'realizadas');
        $nuevos = [];
        foreach (['adicionales', 'logros', 'impedimentos', 'comentarios', 'acuerdos'] as $campo) $nuevos[$campo] = Validar::textos($data[$campo] ?? [], $campo);
        $confirmacion = Validar::booleano($data['confirmar_anticipada'] ?? false, 'confirmar_anticipada');
        return Transaccion::ejecutar(function () use ($id, $realizadas, $nuevos, $confirmacion) {
            $sprint = Sprint::lockForUpdate()->findOrFail($id);
            if ($sprint->finalizado()) throw new ApiException(409, 'RETROSPECTIVA_FINALIZADA', 'Esta retrospectiva ya fue finalizada.');
            if ($sprint->fecha_inicio > Reloj::hoy()) throw new ApiException(409, 'SPRINT_NO_INICIADO', 'El sprint todavía no ha comenzado.');
            if ($sprint->fecha_fin > Reloj::hoy() && !$confirmacion) {
                throw new ApiException(
                    409,
                    'CONFIRMACION_REQUERIDA',
                    'La retrospectiva está programada para ' . $sprint->fecha_fin . '. ¿Quieres realizarla ahora?',
                    ['fecha_programada' => $sprint->fecha_fin, 'confirmar_anticipada' => true]
                );
            }
            $acciones = $sprint->items()->where('categoria', 'accion')->pluck('id')->map(fn($i) => (int)$i)->all();
            if (array_diff($realizadas, $acciones)) Validar::error('Hay objetivos seleccionados que no pertenecen a este sprint.');
            $sprint->items()->where('categoria', 'accion')->update(['cumplida' => false]);
            if ($realizadas) $sprint->items()->whereIn('id', $realizadas)->where('categoria', 'accion')->update(['cumplida' => true]);
            foreach (['adicionales' => 'accion', 'logros' => 'logro', 'impedimentos' => 'impedimento', 'comentarios' => 'comentario', 'acuerdos' => 'accion'] as $campo => $categoria) {
                foreach ($nuevos[$campo] as $descripcion) $sprint->items()->create([
                    'categoria' => $categoria,
                    'descripcion' => $descripcion,
                    'cumplida' => $categoria === 'accion' ? $campo === 'adicionales' : null
                ]);
            }
            $sprint->items()->create(['categoria' => 'otro', 'descripcion' => RetroItem::CIERRE, 'fecha_revision' => Reloj::hoy()]);
            return $this->detalle($id);
        });
    }
}
