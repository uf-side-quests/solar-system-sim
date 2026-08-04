#include <emscripten/emscripten.h>
#include <math.h>
#include <stddef.h>

#include "rebound.h"

static struct reb_simulation* simulation = NULL;
static size_t active_body_count = 0;
static int test_particles_started = 0;

static int finite_particle(const struct reb_particle* particle) {
    return isfinite(particle->m) && isfinite(particle->x) && isfinite(particle->y) &&
           isfinite(particle->z) && isfinite(particle->vx) && isfinite(particle->vy) &&
           isfinite(particle->vz);
}

EMSCRIPTEN_KEEPALIVE int sste_create(double gravitational_constant) {
    if (!isfinite(gravitational_constant) || gravitational_constant <= 0.0) {
        return 1;
    }
    if (simulation != NULL) {
        reb_simulation_free(simulation);
    }
    simulation = reb_simulation_create();
    if (simulation == NULL) {
        return 2;
    }
    simulation->G = gravitational_constant;
    simulation->save_messages = 1;
    simulation->exact_finish_time = 1;
    if (reb_simulation_set_integrator(simulation, "ias15") == NULL) {
        reb_simulation_free(simulation);
        simulation = NULL;
        return 3;
    }
    active_body_count = 0;
    test_particles_started = 0;
    return 0;
}

EMSCRIPTEN_KEEPALIVE int sste_add_body(
    double mass,
    double x,
    double y,
    double z,
    double vx,
    double vy,
    double vz
) {
    if (simulation == NULL) {
        return 1;
    }
    if (!isfinite(mass) || mass < 0.0 || !isfinite(x) || !isfinite(y) || !isfinite(z) ||
        !isfinite(vx) || !isfinite(vy) || !isfinite(vz)) {
        return 2;
    }
    if (mass > 0.0 && test_particles_started) {
        return 3;
    }
    if (mass == 0.0 && !test_particles_started) {
        simulation->N_active = active_body_count;
        simulation->testparticle_type = 0;
        test_particles_started = 1;
    }

    struct reb_particle particle = {0};
    particle.m = mass;
    particle.x = x;
    particle.y = y;
    particle.z = z;
    particle.vx = vx;
    particle.vy = vy;
    particle.vz = vz;
    reb_simulation_add(simulation, particle);
    if (mass > 0.0) {
        active_body_count += 1;
    }
    return simulation->N == active_body_count && !test_particles_started ? 0 :
           simulation->N >= active_body_count ? 0 : 4;
}

EMSCRIPTEN_KEEPALIVE int sste_move_to_barycentre(void) {
    if (simulation == NULL || simulation->N == 0) {
        return 1;
    }
    reb_simulation_move_to_com(simulation);
    return 0;
}

EMSCRIPTEN_KEEPALIVE int sste_integrate(double target_time_seconds) {
    if (simulation == NULL || simulation->N == 0 || !isfinite(target_time_seconds)) {
        return 1;
    }
    const enum REB_STATUS status = reb_simulation_integrate(simulation, target_time_seconds);
    reb_simulation_synchronize(simulation);
    if (status < REB_STATUS_SUCCESS) {
        return 2;
    }
    for (size_t index = 0; index < simulation->N; index += 1) {
        if (!finite_particle(&simulation->particles[index])) {
            return 3;
        }
    }
    return 0;
}

EMSCRIPTEN_KEEPALIVE double sste_time(void) {
    return simulation == NULL ? NAN : simulation->t;
}

EMSCRIPTEN_KEEPALIVE double sste_energy(void) {
    return simulation == NULL ? NAN : reb_simulation_energy(simulation);
}

EMSCRIPTEN_KEEPALIVE int sste_body_count(void) {
    return simulation == NULL ? -1 : (int)simulation->N;
}

EMSCRIPTEN_KEEPALIVE int sste_active_body_count(void) {
    return simulation == NULL ? -1 : (int)active_body_count;
}

EMSCRIPTEN_KEEPALIVE double sste_body_value(int body_index, int field_index) {
    if (simulation == NULL || body_index < 0 || (size_t)body_index >= simulation->N) {
        return NAN;
    }
    const struct reb_particle* particle = &simulation->particles[body_index];
    switch (field_index) {
        case 0: return particle->m;
        case 1: return particle->x;
        case 2: return particle->y;
        case 3: return particle->z;
        case 4: return particle->vx;
        case 5: return particle->vy;
        case 6: return particle->vz;
        default: return NAN;
    }
}
