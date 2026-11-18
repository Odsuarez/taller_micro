<?php
declare(strict_types=1);
namespace App\Controllers;
use App\Models\Sprint;
use App\Models\RetroItem;
use App\Support\Validar;
use App\Services\Transaccion;
final class ItemsController {
    public function find(int $id): RetroItem { return RetroItem::visibles()->findOrFail($id); }
    public function all(int $sprintId): array {
        $sprint=Sprint::findOrFail($sprintId);
        return $sprint->items()->visibles()->orderBy('id')->get()->toArray();
    }
    private function validar(array $data): array {
        $categoria=$data['categoria'] ?? null;
        if (!is_string($categoria) || !in_array($categoria,['accion','logro','impedimento','comentario','otro'],true)) Validar::error('La categoría no es válida.');
        $descripcion=Validar::texto($data['descripcion'] ?? null,'descripcion');
        $cumplida=$categoria==='accion' ? Validar::booleano($data['cumplida'] ?? false,'cumplida') : null;
        $revision=isset($data['fecha_revision']) ? Validar::fecha($data['fecha_revision'],'fecha_revision') : null;
        if ($categoria==='otro' && $descripcion===RetroItem::CIERRE) Validar::error('La descripción está reservada para el cierre de la retrospectiva.');
        return ['categoria'=>$categoria,'descripcion'=>$descripcion,'cumplida'=>$cumplida,'fecha_revision'=>$revision];
    }
    public function create(int $sprintId,array $data): RetroItem {
        $validado=$this->validar($data);
        return Transaccion::ejecutar(function() use ($sprintId,$validado) {
            return Sprint::findOrFail($sprintId)->items()->create($validado);
        });
    }
    public function update(int $id,array $data): RetroItem {
        return Transaccion::ejecutar(function() use ($id,$data) {
            $item=RetroItem::visibles()->lockForUpdate()->findOrFail($id);
            $validado=$this->validar(array_merge($item->only(['categoria','descripcion','cumplida','fecha_revision']),$data));
            $item->fill($validado)->save();
            return $item->fresh();
        });
    }
    public function delete(int $id): void {
        Transaccion::ejecutar(function() use ($id) { RetroItem::visibles()->lockForUpdate()->findOrFail($id)->delete(); });
    }
}
