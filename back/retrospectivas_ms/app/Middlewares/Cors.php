<?php

declare(strict_types=1);

namespace App\Middlewares;

use App\Support\Json;
use Slim\Psr7\Response;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Psr\Http\Server\MiddlewareInterface;

final class Cors implements MiddlewareInterface
{
    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $origin = $request->getHeaderLine('Origin');
        $allowed = array_filter(array_map('trim', explode(',', $_ENV['FRONTEND_ORIGINS'] ?? 'http://localhost,http://127.0.0.1,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8080,http://localhost:8080')));
        $mismoOrigen = $request->getUri()->getScheme() . '://' . $request->getUri()->getAuthority();
        if ($origin !== '' && !in_array($origin, $allowed, true) && $origin !== $mismoOrigen) {
            return Json::response(new Response(), ['ok' => false, 'error' => ['codigo' => 'ORIGEN_NO_PERMITIDO', 'mensaje' => 'El origen del frontend no está permitido.']], 403);
        }
        $response = $request->getMethod() === 'OPTIONS' ? new Response(204) : $handler->handle($request);
        if ($origin !== '') $response = $response->withHeader('Access-Control-Allow-Origin', $origin)->withAddedHeader('Vary', 'Origin');
        return $response->withHeader('Access-Control-Allow-Headers', 'Content-Type, Accept')
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
}
