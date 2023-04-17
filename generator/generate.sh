#!/bin/bash

fakeit() {
  docker run --rm -v ${PWD}:/data -w /data  bentonam/fakeit "$@"
}

cbq() {
  docker run --rm couchbase:7.1.4 cbq "$@"
}

# Generate fake data
if [ -z "$1" ] || [ "$1" = "local" ]; then
  echo "Cleaning old generated data"
                  rm -rf results
  echo "Generating data to folder"
  fakeit folder -v results models/*.yml "$( (( "$2" )) && printf %s "-c $2" )"
elif [ "$1" = "couchbase" ]; then
#  echo "Cleaning old generated data"
#  cbq -q -e "http://localhost:8091" -s "$(cat requests/clean.n1ql)" -u Administrator -p password

  echo "Generate new data"
  fakeit couchbase -r -v -w 100 -b wasl -s localhost -u Administrator -p password models/*.yml "$( (( "$2" )) && printf %s "-c $2" )"
fi
