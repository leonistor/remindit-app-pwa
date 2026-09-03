# feedback module

Downloaded binary in local folder then run `./answer run -C ./answer-data/`

<port> in prompt is 5555

## folders

```
ls -1 answer-data/
cache
conf
db
i18n
uploads
```

## config file

```
cat answer-data/conf/config.yaml
debug: false
server:
  http:
    addr: 0.0.0.0:5555
data:
  database:
    driver: sqlite3
    connection: ./db/answer.db
  cache:
    file_path: answer-data/cache/cache.db
i18n:
  bundle_dir: answer-data/i18n
service_config:
  upload_path: answer-data/uploads
  clean_up_uploads: true
  clean_orphan_uploads_period_hours: 48
  purge_deleted_files_period_days: 30
ui:
  base_url: ""
  api_base_url: ""
```

## Tags

- feature-request: For proposals of new features on the software, or requests for a change to an existing feature.
- bug: Something isn't working that you believe is due to a mistake, malfunction, or programming error.
- discussion: For questions that may not necessarily have a clear-cut right or wrong answer.
- development: Questions about development.
