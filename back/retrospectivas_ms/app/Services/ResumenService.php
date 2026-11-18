<?php
declare(strict_types=1);
namespace App\Services;
use App\Models\Sprint;
use App\Support\Reloj;
final class ResumenService {
    public function detalle(Sprint $sprint): array {
        $items=$sprint->items()->visibles()->orderBy('id')->get();
        $acciones=$items->where('categoria','accion');
        return [
            'sprint'=>array_merge($sprint->toArray(),['estado'=>$sprint->finalizado() ? 'finalizado' : ($sprint->fecha_inicio>Reloj::hoy() ? 'programado' : 'actual')]),
            'items'=>$items->toArray(),
            'realizadas'=>$acciones->where('cumplida',true)->values()->toArray(),
            'pendientes'=>$acciones->filter(fn($i)=>$i->cumplida!==true)->values()->toArray(),
            'logros'=>$items->where('categoria','logro')->values()->toArray(),
            'impedimentos'=>$items->where('categoria','impedimento')->values()->toArray(),
            'comentarios'=>$items->where('categoria','comentario')->values()->toArray()
        ];
    }
    public function global(int $limite = 3): array {
        $sprints=Sprint::finalizados()->with('cierre')->get()->sortByDesc(fn($s)=>$s->cierre->id);
        $vistos=[];$realizadas=[];$pendientes=[];$logros=0;$impedimentos=0;
        foreach ($sprints as $sprint) {
            foreach ($sprint->items()->visibles()->orderByDesc('id')->get() as $item) {
                if ($item->categoria==='logro') $logros++;
                if ($item->categoria==='impedimento') $impedimentos++;
                if ($item->categoria!=='accion') continue;
                $clave=mb_strtolower(preg_replace('/\s+/u',' ',trim($item->descripcion)));
                if (isset($vistos[$clave])) continue;
                $vistos[$clave]=true;
                $row=array_merge($item->toArray(),['sprint_nombre'=>$sprint->nombre]);
                if ($item->cumplida===true) $realizadas[]=$row;
                else $pendientes[]=$row;
            }
        }
        $lista=fn($items)=>['total'=>count($items),'items'=>$limite===0 ? $items : array_slice($items,0,$limite),'restantes'=>$limite===0 ? 0 : max(0,count($items)-$limite)];
        return ['sprints_finalizados'=>$sprints->count(),'realizadas'=>$lista($realizadas),'pendientes'=>$lista($pendientes),'logros'=>$logros,'impedimentos'=>$impedimentos,'criterio'=>'Último estado de objetivos con la misma descripción.'];
    }
}
