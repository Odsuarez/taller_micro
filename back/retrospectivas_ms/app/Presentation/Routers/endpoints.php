<?php

declare(strict_types=1);

use Slim\App;
use App\Presentation\Repositories\RetrospectivasRepository as Api;

return function (App $app): void {
    $app->get('/salud', [Api::class, 'salud']);
    $app->get('/estado', [Api::class, 'estado']);
    $app->get('/sprints', [Api::class, 'sprints']);
    $app->get('/sprints/actual', [Api::class, 'actual']);
    $app->get('/sprints/anteriores', [Api::class, 'anteriores']);
    $app->get('/sprints/ultimo/acciones', [Api::class, 'accionesAnteriores']);
    $app->post('/sprints', [Api::class, 'crearSprint']);
    $app->get('/sprints/{id:[0-9]+}', [Api::class, 'sprint']);
    $app->put('/sprints/{id:[0-9]+}', [Api::class, 'editarSprint']);
    $app->get('/sprints/{id:[0-9]+}/items', [Api::class, 'items']);
    $app->post('/sprints/{id:[0-9]+}/items', [Api::class, 'crearItem']);
    $app->get('/items/{id:[0-9]+}', [Api::class, 'item']);
    $app->put('/items/{id:[0-9]+}', [Api::class, 'editarItem']);
    $app->delete('/items/{id:[0-9]+}', [Api::class, 'eliminarItem']);
    $app->get('/sprints/{id:[0-9]+}/retrospectiva', [Api::class, 'retrospectiva']);
    $app->post('/sprints/{id:[0-9]+}/retrospectiva/finalizar', [Api::class, 'finalizar']);
    $app->get('/proyecto/resumen', [Api::class, 'resumen']);
};
