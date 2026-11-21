<?php

declare(strict_types=1);

use Illuminate\Database\Capsule\Manager as Capsule;

$capsule = new Capsule();
$driver = $_ENV['DB_DRIVER'] ?? getenv('DB_DRIVER') ?: 'mysql';
if ($driver === 'sqlite') {
    $connection = ['driver' => 'sqlite', 'database' => $_ENV['DB_DATABASE'] ?? getenv('DB_DATABASE') ?: ':memory:', 'prefix' => '', 'foreign_key_constraints' => true];
} else {
    $connection = [
        'driver' => 'mysql',
        'host' => $_ENV['DB_HOST'] ?? '127.0.0.1',
        'port' => $_ENV['DB_PORT'] ?? '3306',
        'database' => $_ENV['DB_DATABASE'] ?? 'registro_retro_db',
        'username' => $_ENV['DB_USERNAME'] ?? 'root',
        'password' => $_ENV['DB_PASSWORD'] ?? '',
        'charset' => 'utf8mb4',
        'collation' => 'utf8mb4_unicode_ci',
        'prefix' => '',
        'strict' => true
    ];
}
$capsule->addConnection($connection);
$capsule->setAsGlobal();
$capsule->bootEloquent();
return $capsule;
