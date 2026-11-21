<?php

declare(strict_types=1);

namespace App\Presentation\Repositories;

use App\Controllers\SprintsController;
use App\Controllers\ItemsController;
use App\Controllers\RetrospectivasController;
use App\Services\ResumenService;
use App\Services\PoliticaRetrospectiva;
use App\Support\Json;
use App\Support\Validar;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;

final class RetrospectivasRepository
{
    public function salud(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, ['servicio' => 'retrospectivas_ms', 'estado' => 'disponible']);
    }
    public function estado(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new PoliticaRetrospectiva())->estado());
    }
    public function sprints(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new SprintsController())->all());
    }
    public function actual(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new SprintsController())->actual());
    }
    public function anteriores(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new SprintsController())->anteriores());
    }
    public function accionesAnteriores(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new SprintsController())->accionesAnteriores());
    }
    public function sprint(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new ResumenService())->detalle((new SprintsController())->find(Validar::id($a['id']))));
    }
    public function crearSprint(Request $r, Response $s, array $a): Response
    {
        $data = (new SprintsController())->create(Json::body($r));
        return Json::ok($s, $data, 201)->withHeader('Location', '/sprints/' . $data['sprint']['id']);
    }
    public function editarSprint(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new SprintsController())->update(Validar::id($a['id']), Json::body($r)));
    }
    public function items(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new ItemsController())->all(Validar::id($a['id'])));
    }
    public function item(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new ItemsController())->find(Validar::id($a['id']))->toArray());
    }
    public function crearItem(Request $r, Response $s, array $a): Response
    {
        $item = (new ItemsController())->create(Validar::id($a['id']), Json::body($r));
        return Json::ok($s, $item->toArray(), 201)->withHeader('Location', '/items/' . $item->id);
    }
    public function editarItem(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new ItemsController())->update(Validar::id($a['id']), Json::body($r))->toArray());
    }
    public function eliminarItem(Request $r, Response $s, array $a): Response
    {
        (new ItemsController())->delete(Validar::id($a['id']));
        return Json::ok($s, ['mensaje' => 'Registro eliminado.']);
    }
    public function retrospectiva(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new RetrospectivasController())->detalle(Validar::id($a['id'])));
    }
    public function finalizar(Request $r, Response $s, array $a): Response
    {
        return Json::ok($s, (new RetrospectivasController())->finalizar(Validar::id($a['id']), Json::body($r)));
    }
    public function resumen(Request $r, Response $s, array $a): Response
    {
        $limite = $r->getQueryParams()['limite'] ?? '3';
        if (!is_scalar($limite) || filter_var($limite, FILTER_VALIDATE_INT) === false || (int)$limite < 0 || (int)$limite > 100) Validar::error('limite debe ser un entero entre 0 y 100. Usa 0 para ver todos.');
        return Json::ok($s, (new ResumenService())->global((int)$limite));
    }
}
