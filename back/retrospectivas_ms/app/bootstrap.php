<?php

declare(strict_types=1);

use Slim\Factory\AppFactory;
use App\Exceptions\ApiException;
use App\Support\Json;
use App\Middlewares\Cors;
use App\Middlewares\BloqueoRetrospectiva;
use Slim\Exception\HttpException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;

require __DIR__ . '/../vendor/autoload.php';
date_default_timezone_set($_ENV['APP_TIMEZONE'] ?? 'America/Bogota');
require __DIR__ . '/global/database_config.php';
$app = AppFactory::create();
$app->addBodyParsingMiddleware();
$app->addRoutingMiddleware();
$app->add(new BloqueoRetrospectiva());
$errors = $app->addErrorMiddleware(false, true, true);
$errors->setDefaultErrorHandler(function ($request, Throwable $exception, bool $displayErrorDetails, bool $logErrors, bool $logErrorDetails) use ($app) {
    $status = 500;
    $codigo = 'ERROR_INTERNO';
    $mensaje = 'No se pudo completar la operación.';
    $detalles = [];
    if ($exception instanceof ApiException) {
        $status = $exception->status;
        $codigo = $exception->codigo;
        $mensaje = $exception->getMessage();
        $detalles = $exception->detalles;
    } elseif ($exception instanceof ModelNotFoundException) {
        $status = 404;
        $codigo = 'NO_ENCONTRADO';
        $mensaje = 'El registro solicitado no existe.';
    } elseif ($exception instanceof HttpException) {
        $status = $exception->getCode();
        $codigo = 'RUTA_NO_DISPONIBLE';
        $mensaje = $status === 405 ? 'El método HTTP no está permitido para esta ruta.' : 'La ruta solicitada no existe.';
    } elseif ($exception instanceof QueryException || $exception instanceof PDOException) {
        $status = 503;
        $codigo = 'BASE_DATOS_NO_DISPONIBLE';
        $mensaje = 'No se pudo consultar la base de datos. Revisa la conexión y que existan las tablas originales.';
        error_log($exception->getMessage());
    } else {
        error_log((string)$exception);
    }
    $response = Json::response($app->getResponseFactory()->createResponse(), ['ok' => false, 'error' => ['codigo' => $codigo, 'mensaje' => $mensaje, 'detalles' => $detalles]], $status);
    if ($exception instanceof \Slim\Exception\HttpMethodNotAllowedException) $response = $response->withHeader('Allow', implode(', ', $exception->getAllowedMethods()));
    return $response;
});
$app->add(new Cors());
(require __DIR__ . '/Presentation/Routers/endpoints.php')($app);
return $app;
