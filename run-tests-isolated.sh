#!/bin/bash -eu

ISOLATED_UNIQ_ID=${BUILD_NUMBER:-$(date +"%Y-%m-%dT%H:%M:%S")}
JOB=${TEST_JOB-test}

function finish {
  docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.test.yml stop
  docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.test.yml rm -f
}
trap finish EXIT

docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.test.yml build mongo1 sentineltest1 "${JOB}"
docker-compose -p "webapp-${ISOLATED_UNIQ_ID}" -f docker-compose.test.yml run --rm "${JOB}"