# Part 1A — deterministic harness, one command.
# Default target runs the whole bounded generate->sense->repair->audit loop.
.PHONY: harness sensor test clean

harness:
	node .harness/run_all.js

sensor:
	node .harness/sensor.js .

test:
	node --test tests/app.test.js

clean:
	rm -f sensor-report.json
