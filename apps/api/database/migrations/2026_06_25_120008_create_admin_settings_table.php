<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->cascadeOnDelete();
            $table->string('app_name')->nullable();
            $table->string('contact_email')->nullable();
            $table->string('timezone')->nullable();
            $table->decimal('premium_price', 12, 2)->nullable();
            $table->integer('grace_period')->nullable();
            $table->boolean('alerts_enabled')->default(true);
            $table->boolean('notify_new_subs')->default(true);
            $table->boolean('notify_late_payments')->default(true);
            $table->boolean('notify_reports')->default(false);
            $table->boolean('multi_sessions')->default(true);
            $table->boolean('twofa_enabled')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_settings');
    }
};
