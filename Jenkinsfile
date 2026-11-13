// Deploys a pivault-backend image (already built by GitHub Actions) to staging on the Pi.
// Triggered by GitHub's "package published" webhook, or manually with IMAGE_TAG.

def notify(String msg) {
  withCredentials([
    string(credentialsId: 'telegram-bot-token', variable: 'TG_TOKEN'),
    string(credentialsId: 'telegram-chat-id', variable: 'TG_CHAT')
  ]) {
    withEnv(["TG_MSG=${msg}"]) {
      sh 'curl -sS -X POST "https://api.telegram.org/bot$TG_TOKEN/sendMessage" -d chat_id="$TG_CHAT" --data-urlencode text="$TG_MSG" > /dev/null || true'
    }
  }
}

pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timeout(time: 15, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  parameters {
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'e.g. staging-abc1234 (the webhook fills this in)')
  }

  triggers {
    GenericTrigger(
      genericVariables: [[key: 'IMAGE_TAG', value: '$.package.package_version.container_metadata.tag.name', defaultValue: '']],
      tokenCredentialId: 'pivault-backend-hook-token',
      regexpFilterText: '$IMAGE_TAG',
      regexpFilterExpression: '^staging-[0-9a-f]{7}$',
      causeString: 'GHCR published $IMAGE_TAG',
      printContributedVariables: true
    )
  }

  environment {
    APP_DIR    = '/home/shiv/apps/pivault'
    IMAGE      = 'ghcr.io/shivamingale3/pivault-backend'
    STATE_FILE = '/home/shiv/apps/pivault/.deploy/backend.last-good'
    HEALTH_URL = 'https://pivault-staging.shivamingale.com/api/health/ready'
  }

  stages {
    stage('Validate') {
      steps {
        script {
          if (!(params.IMAGE_TAG ==~ /^staging-[0-9a-f]{7}$/)) {
            error "IMAGE_TAG '${params.IMAGE_TAG}' is not staging-<7 hex chars>"
          }
          env.PREV_TAG = sh(script: 'cat "$STATE_FILE" 2>/dev/null || true', returnStdout: true).trim()
          echo "Deploying ${params.IMAGE_TAG} (rollback target: ${env.PREV_TAG ?: 'none'})"
        }
      }
    }

    stage('Pull') {
      steps {
        sh 'docker pull "$IMAGE:$IMAGE_TAG"'
      }
    }

    stage('Migrate') {
      steps {
        sh 'docker run --rm --network host --env-file "$APP_DIR/.env" "$IMAGE:$IMAGE_TAG" npx prisma migrate deploy'
      }
    }

    stage('Swap') {
      steps {
        sh 'cd "$APP_DIR" && docker compose up -d --wait --wait-timeout 60'
      }
    }

    stage('Health') {
      steps {
        sh '''
          for i in $(seq 1 12); do
            if curl -fsS "$HEALTH_URL"; then echo; exit 0; fi
            echo "not ready yet ($i/12)"; sleep 5
          done
          exit 1
        '''
      }
    }
  }

  post {
    success {
      sh '''
        mkdir -p "$(dirname "$STATE_FILE")"
        echo "$IMAGE_TAG" > "$STATE_FILE"
        # keep only the image that is running now
        docker images "$IMAGE" --format '{{.Tag}}' | grep -vx "$IMAGE_TAG" \
          | xargs -r -I{} docker rmi "$IMAGE:{}" || true
      '''
      notify("✅ pivault-backend ${params.IMAGE_TAG} deployed to staging")
    }

    failure {
      script {
        def rolledBack = false
        if (env.PREV_TAG && env.PREV_TAG != params.IMAGE_TAG) {
          withEnv(["IMAGE_TAG=${env.PREV_TAG}"]) {
            sh 'cd "$APP_DIR" && docker compose up -d --wait --wait-timeout 60 || true'
          }
          rolledBack = true
        }
        def msg = "❌ pivault-backend ${params.IMAGE_TAG} deploy FAILED"
        msg += rolledBack ? "\nrunning ${env.PREV_TAG} (last good)" : "\nno rollback target"
        msg += "\n${env.BUILD_URL}console"
        notify(msg)
      }
    }
  }
}
