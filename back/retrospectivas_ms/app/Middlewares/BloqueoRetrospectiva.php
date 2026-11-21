<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Services\PoliticaRetrospectiva;
use App\Exceptions\ApiException;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Http\Server\MiddlewareInterface;

final class BloqueoRetrospectiva implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $path = $request->getUri()->getPath();
        if ($request->getMethod() === 'OPTIONS' || in_array($path, ['/salud', '/estado'], true)) return $handler->handle($request);
        $estado = (new PoliticaRetrospectiva())->estado();
        if ($estado['bloquear_navegacion']) {
            $id = $estado['sprint_actual_id'];
            $permitido = ($request->getMethod() === 'GET' && $path === "/sprints/$id/retrospectiva")
                || ($request->getMethod() === 'POST' && $path === "/sprints/$id/retrospectiva/finalizar");
            if (!$permitido) throw new ApiException(423, 'RETROSPECTIVA_PENDIENTE', $estado['mensaje'], $estado);
        }
        return $handler->handle($request);
    }
}
